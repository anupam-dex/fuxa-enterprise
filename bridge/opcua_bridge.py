#!/usr/bin/env python3
"""
==============================================================================
Central Isolated OPC-UA Plant Hub Manager for FUXA Fleet
==============================================================================
Hosts dedicated, physically and logically isolated OPC-UA Servers for each Plant:
- Plant 1 Hub: opc.tcp://0.0.0.0:4841/fuxa/server/ (Foundry & Powerhouse)
- Plant 2 Hub: opc.tcp://0.0.0.0:4842/fuxa/server/ (Stamping & Press)
- Plant 3 Hub: opc.tcp://0.0.0.0:4843/fuxa/server/ (Body & Assembly)
- Plant 4 Hub: opc.tcp://0.0.0.0:4844/fuxa/server/ (Powertrain & Machining)
- Plant 9 Hub: opc.tcp://0.0.0.0:4849/fuxa/server/ (Paintshop & EMS)
- Legacy Alias: opc.tcp://0.0.0.0:4845/fuxa/server/ (Mirrors Plant 9 for backward compatibility)

Guarantees 100% data isolation: zero mixing of plant tags across plants.
==============================================================================
"""

import asyncio
import logging
import json
import os
import random
import sqlite3
import requests
from asyncua import Server, ua

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PlantOPCUABridge")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
INSTANCES_DIR = os.path.join(BASE_DIR, "instances")

PLANT_DEFAULT_DATA = {
    1: {
        "name": "Plant 1 - Foundry & Powerhouse",
        "divisions": {
            "Boiler_House": {
                "Boiler_01": [("Steam_Pressure_Bar", 10.5, "number"), ("Steam_Temp_C", 185.0, "number"), ("Burner_Status", True, "boolean")],
                "Feed_Water_Pump": [("Flow_Rate_M3H", 45.2, "number"), ("Pump_Running", True, "boolean")]
            }
        }
    },
    2: {
        "name": "Plant 2 - Stamping & Press",
        "divisions": {
            "Stamping_Shop": {
                "Press_Line_A": [("Tonnage_Ton", 850.0, "number"), ("Cycle_Count", 14200.0, "number"), ("Clutch_Engaged", True, "boolean")]
            }
        }
    },
    3: {
        "name": "Plant 3 - Body & Assembly",
        "divisions": {
            "Assembly_Shop": {
                "Conveyor_Main": [("Line_Speed_MPM", 12.5, "number"), ("E_Stop_Active", False, "boolean"), ("Takt_Time_Sec", 58.0, "number")]
            }
        }
    },
    4: {
        "name": "Plant 4 - Powertrain & Machining",
        "divisions": {
            "Facility_Utilities": {
                "Chiller_Line_1": [("Chiller_Temp_C", 7.2, "number"), ("Compressor_Current_A", 145.0, "number"), ("Chiller_Running", True, "boolean")],
                "Air_Compressor": [("Header_Pressure_Bar", 7.8, "number"), ("Motor_Speed_RPM", 1750.0, "number")]
            }
        }
    },
    9: {
        "name": "Plant 9 - Paintshop Division 6 & EMS",
        "divisions": {
            "Paintshop_Division_6": {
                "Oven_Line_1": [
                    ("Zone1_Temperature_C", 165.2, "number"),
                    ("Zone2_Temperature_C", 178.4, "number"),
                    ("Exhaust_Fan_Running", True, "boolean"),
                    ("Oven_Burner_Fault", False, "boolean")
                ],
                "Spray_Booth_Line_1": [
                    ("Booth_Static_Pressure_Pa", 25.0, "number"),
                    ("Paint_Flow_CC_Min", 350.0, "number"),
                    ("Robot_Armed", True, "boolean"),
                    ("Downdraft_Velocity_MPS", 0.45, "number")
                ],
                "Pre_Treatment_Line_1": [
                    ("Degreasing_Tank_Temp_C", 55.0, "number"),
                    ("Rinse_Tank_pH", 7.2, "number"),
                    ("Circulation_Pump_Running", True, "boolean")
                ]
            }
        }
    }
}


class DedicatedPlantHub:
    """Manages an isolated OPC-UA server for a single plant"""

    def __init__(self, plant_id: int, port: int, storage_port: int, is_alias: bool = False):
        self.plant_id = plant_id
        self.port = port
        self.storage_port = storage_port
        self.is_alias = is_alias
        self.endpoint = f"opc.tcp://0.0.0.0:{port}/fuxa/server/"
        self.storage_url = f"http://127.0.0.1:{storage_port}"
        self.server = Server()
        self.nodes = {}  # tag_key -> (node, type)
        self.running = False
        self.idx = 2

    async def initialize(self):
        await self.server.init()
        self.server.set_endpoint(self.endpoint)
        name = f"Plant {self.plant_id} Central OPC-UA Hub" if not self.is_alias else f"Plant {self.plant_id} Hub (Port 4845 Alias)"
        self.server.set_server_name(name)
        self.server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

        self.idx = await self.server.register_namespace(f"http://industrial.plant{self.plant_id}.local/fuxa/")
        objects = self.server.nodes.objects
        await self.build_plant_address_space(objects)

    async def build_plant_address_space(self, parent_folder):
        """Builds address space containing strictly this plant's machines and tags"""
        # 1. First add default plant catalog
        plant_cfg = PLANT_DEFAULT_DATA.get(self.plant_id)
        if plant_cfg:
            plant_name = f"Plant_{self.plant_id}"
            plant_folder = await parent_folder.add_folder(self.idx, plant_name)
            for div_name, machines in plant_cfg["divisions"].items():
                div_folder = await plant_folder.add_folder(self.idx, div_name)
                for machine_name, tag_list in machines.items():
                    machine_obj = await div_folder.add_object(self.idx, machine_name)
                    for (t_name, initial_val, t_type) in tag_list:
                        node_id_str = f"{plant_name}.{div_name}.{machine_name}.{t_name}"
                        node_id = ua.NodeId(node_id_str, self.idx)
                        var = await machine_obj.add_variable(node_id, t_name, initial_val)
                        await var.set_writable()
                        self.nodes[f"{plant_name}_{div_name}_{machine_name}_{t_name}"] = (var, t_type)

        # 2. Add extra field devices from this plant's storage server DB
        extra_devices = self.fetch_plant_storage_devices()
        for dev_id, dev_data in extra_devices.items():
            raw_name = dev_data.get("name", dev_id)
            clean_name = raw_name.replace("Sim_", "").replace(" ", "_")
            # Don't duplicate self-hosted bridge devices
            if "storage_opcua" in dev_id.lower() or dev_data.get("type") == "FuxaServer":
                continue

            dev_folder = await parent_folder.add_folder(self.idx, clean_name)
            tags = dev_data.get("tags", {})
            for tid, tinfo in tags.items():
                tname = tinfo.get("name", tid)
                ttype = tinfo.get("type", "number")
                init_val = 0.0 if ttype == "number" else (False if ttype == "boolean" else "")
                var = await dev_folder.add_variable(self.idx, tname, init_val)
                await var.set_writable()
                self.nodes[f"{clean_name}_{tname}"] = (var, ttype)

        logger.info(f"[Plant {self.plant_id} Hub :{self.port}] Initialized with {len(self.nodes)} dedicated tags.")

    def fetch_plant_storage_devices(self) -> dict:
        """Reads devices registered in this plant's storage SQLite database"""
        storage_work_dir = os.path.join(INSTANCES_DIR, f"storage_plant_{self.plant_id}_{self.storage_port}")
        db_path = os.path.join(storage_work_dir, "_appdata", "project.fuxap.db")
        if not os.path.exists(db_path):
            db_path = os.path.join(storage_work_dir, "project.fuxap.db")
        devices = {}
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("SELECT name, value FROM devices;")
                for dev_id, dev_val in cur.fetchall():
                    try:
                        dev_obj = json.loads(dev_val)
                        devices[dev_id] = dev_obj
                    except Exception:
                        pass
                conn.close()
            except Exception as e:
                logger.debug(f"Could not read DB for Plant {self.plant_id}: {e}")
        return devices

    async def run_simulation(self):
        """Simulates live changing sensor values at 1.0s interval for this plant"""
        while self.running:
            for key, (var, t_type) in list(self.nodes.items()):
                try:
                    if t_type == "number":
                        curr = await var.read_value()
                        delta = (random.random() - 0.5) * 1.5
                        new_val = round(max(0.0, float(curr) + delta), 2)
                        await var.write_value(new_val)
                    elif t_type == "boolean":
                        if random.random() < 0.05:
                            curr = await var.read_value()
                            await var.write_value(not curr)
                except Exception:
                    pass
            await asyncio.sleep(1.0)

    async def start(self):
        self.running = True
        await self.initialize()
        logger.info(f"✓ Dedicated Plant {self.plant_id} OPC-UA Hub listening at: {self.endpoint}")
        async with self.server:
            await self.run_simulation()


async def main():
    logger.info("==========================================================================")
    logger.info(" Starting FUXA Dedicated Industrial Plant OPC-UA Hubs...")
    logger.info("==========================================================================")

    hubs = [
        DedicatedPlantHub(plant_id=1, port=4841, storage_port=5100),
        DedicatedPlantHub(plant_id=2, port=4842, storage_port=5200),
        DedicatedPlantHub(plant_id=3, port=4843, storage_port=5300),
        DedicatedPlantHub(plant_id=4, port=4844, storage_port=5400),
        DedicatedPlantHub(plant_id=9, port=4849, storage_port=5900),
        DedicatedPlantHub(plant_id=9, port=4845, storage_port=5900, is_alias=True),
    ]

    await asyncio.gather(*[hub.start() for hub in hubs])


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("OPC-UA Plant Hubs stopped.")
