#!/usr/bin/env python3
"""
Central OPC-UA Bridge for FUXA Fleet
Exposes Plant Storage Server devices & tags as an OPC-UA Server.
View servers connect here (opc.tcp://127.0.0.1:4840) and browse tags hierarchically.
"""

import asyncio
import logging
import json
import os
import random
import requests
from asyncua import Server, ua

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("OPCUABridge")

OPCUA_PORT = int(os.environ.get("OPCUA_PORT", "4845"))
DEFAULT_ENDPOINT = f"opc.tcp://0.0.0.0:{OPCUA_PORT}/fuxa/server/"
DEFAULT_STORAGE_URL = os.environ.get("FUXA_STORAGE_URL", "http://127.0.0.1:5100")

class OPCUABridge:
    def __init__(self, endpoint=DEFAULT_ENDPOINT, storage_url=DEFAULT_STORAGE_URL):
        self.endpoint = endpoint
        self.storage_url = storage_url
        self.server = Server()
        self.nodes = {}  # nodeId -> variable node
        self.running = False

    async def initialize(self):
        await self.server.init()
        self.server.set_endpoint(self.endpoint)
        self.server.set_server_name("FUXA Central Storage OPC-UA Bridge")
        
        # Set security policy to Anonymous (easy internal connection for View servers)
        self.server.set_security_policy([ua.SecurityPolicyType.NoSecurity])
        
        # Register custom namespace
        self.idx = await self.server.register_namespace("http://industrial.plant.local/fuxa/")
        logger.info(f"Registered OPC-UA Namespace index: {self.idx}")

        # Root Objects folder
        objects = self.server.nodes.objects
        
        # Build hierarchy
        await self.build_address_space(objects)

    async def build_address_space(self, parent_folder):
        """
        Builds the hierarchical address space:
        Plant -> Division -> Line/Machine -> Tags
        Tries to load live tags from FUXA Storage Server; otherwise creates the standard Plant hierarchy.
        """
        storage_devices = self.fetch_storage_server_tags()

        if storage_devices:
            logger.info(f"Loaded {len(storage_devices)} devices from Storage Server.")
            await self._build_from_fuxa_data(parent_folder, storage_devices)
        else:
            logger.info("Storage Server offline or empty. Building default 4-Plant industrial tag hierarchy.")
            await self._build_default_hierarchy(parent_folder)

    def fetch_storage_server_tags(self):
        """Attempts to read project devices & tags from live FUXA Storage Server API"""
        try:
            resp = requests.get(f"{self.storage_url}/api/project", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("devices", {})
        except Exception as e:
            logger.debug(f"Could not connect to storage server at {self.storage_url}: {e}")
        return None

    async def _build_from_fuxa_data(self, root, devices):
        for dev_id, dev in devices.items():
            dev_name = dev.get("name", dev_id)
            dev_folder = await root.add_folder(self.idx, dev_name)
            
            tags = dev.get("tags", {})
            for tag_id, tag in tags.items():
                tag_name = tag.get("name", tag_id)
                tag_type = tag.get("type", "number")
                
                init_val = 0.0 if tag_type == "number" else (False if tag_type == "boolean" else "")
                var = await dev_folder.add_variable(self.idx, tag_name, init_val)
                await var.set_writable()
                self.nodes[f"{dev_name}_{tag_name}"] = (var, tag_type)

    async def _build_default_hierarchy(self, root):
        """
        Default industrial hierarchy for Plant 1..4 & Plant 9 (Paintshop, Body, Assembly)
        Matches real industrial DCS / SCADA standards.
        """
        plants = {
            "Plant_1": {
                "Boiler_House": {
                    "Boiler_01": [("Steam_Pressure_Bar", 10.5, "number"), ("Steam_Temp_C", 185.0, "number"), ("Burner_Status", True, "boolean")],
                    "Feed_Water_Pump": [("Flow_Rate_M3H", 45.2, "number"), ("Pump_Running", True, "boolean")]
                }
            },
            "Plant_2": {
                "Stamping_Shop": {
                    "Press_Line_A": [("Tonnage_Ton", 850.0, "number"), ("Cycle_Count", 14200.0, "number"), ("Clutch_Engaged", True, "boolean")]
                }
            },
            "Plant_3": {
                "Assembly_Shop": {
                    "Conveyor_Main": [("Line_Speed_MPM", 12.5, "number"), ("E_Stop_Active", False, "boolean"), ("Takt_Time_Sec", 58.0, "number")]
                }
            },
            "Plant_4": {
                "Facility_Utilities": {
                    "Chiller_Line_1": [("Chiller_Temp_C", 7.2, "number"), ("Compressor_Current_A", 145.0, "number"), ("Chiller_Running", True, "boolean")],
                    "Air_Compressor": [("Header_Pressure_Bar", 7.8, "number"), ("Motor_Speed_RPM", 1750.0, "number")]
                }
            },
            "Plant_9": {
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

        for plant_name, divisions in plants.items():
            plant_folder = await root.add_folder(self.idx, plant_name)
            for div_name, machines in divisions.items():
                div_folder = await plant_folder.add_folder(self.idx, div_name)
                for machine_name, tag_list in machines.items():
                    machine_obj = await div_folder.add_object(self.idx, machine_name)
                    for (t_name, initial_val, t_type) in tag_list:
                        node_id_str = f"{plant_name}.{div_name}.{machine_name}.{t_name}"
                        node_id = ua.NodeId(node_id_str, self.idx)
                        var = await machine_obj.add_variable(node_id, t_name, initial_val)
                        await var.set_writable()
                        self.nodes[f"{plant_name}_{div_name}_{machine_name}_{t_name}"] = (var, t_type, initial_val)

        logger.info(f"Initialized {len(self.nodes)} OPC-UA industrial tags across all plants.")

    async def run_simulation(self):
        """Simulates live changing sensor values so view servers receive real-time updates"""
        while self.running:
            for key, item in self.nodes.items():
                var, t_type = item[0], item[1]
                if t_type == "number":
                    curr = await var.read_value()
                    delta = (random.random() - 0.5) * 1.5
                    new_val = round(max(0.0, float(curr) + delta), 2)
                    await var.write_value(new_val)
                elif t_type == "boolean":
                    if random.random() < 0.05:  # 5% chance of toggle
                        curr = await var.read_value()
                        await var.write_value(not curr)
            await asyncio.sleep(1.0)

    async def start(self):
        self.running = True
        await self.initialize()
        logger.info(f"================================================================")
        logger.info(f" OPC-UA Central Storage Bridge is ACTIVE at: {self.endpoint}")
        logger.info(f" All FUXA View Servers can browse tags at this endpoint!")
        logger.info(f"================================================================")
        async with self.server:
            await self.run_simulation()

if __name__ == "__main__":
    bridge = OPCUABridge()
    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logger.info("OPC-UA Bridge stopped.")
