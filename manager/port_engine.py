#!/usr/bin/env python3
"""
Port Engine & Registry
Calculates deterministic ports and manages port allocations across plants.
"""

import socket
import json
import os
import psutil

REGISTRY_FILE = os.path.join(os.path.dirname(__file__), "registry.json")

class PortEngine:
    def __init__(self, registry_path=REGISTRY_FILE):
        self.registry_path = registry_path
        self.registry = self._load_registry()

    def _load_registry(self):
        if os.path.exists(self.registry_path):
            try:
                with open(self.registry_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "plants": {
                "1": {"name": "Plant 1 - Foundry & Powerhouse", "storage_port": 5100},
                "2": {"name": "Plant 2 - Stamping & Press", "storage_port": 5200},
                "3": {"name": "Plant 3 - Body & Assembly", "storage_port": 5300},
                "4": {"name": "Plant 4 - Powertrain & Engine", "storage_port": 5400},
                "9": {"name": "Plant 9 - Paintshop Complex", "storage_port": 5900}
            },
            "divisions": {
                "1": "Body Shop",
                "2": "Stamping",
                "3": "Assembly",
                "4": "Quality & Inspection",
                "5": "Utility & Boiler",
                "6": "Paintshop",
                "7": "Robotics & Automation",
                "8": "Material Handling"
            },
            "instances": {}
        }

    def _save_registry(self):
        with open(self.registry_path, "w") as f:
            json.dump(self.registry, f, indent=2)

    def is_port_in_use(self, port: int) -> bool:
        """Checks if a port is listening on the host network"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.2)
            result = s.connect_ex(('127.0.0.1', port))
            return result == 0

    def calculate_port(self, plant: int, division: int, line: int) -> int:
        """
        Calculates base port: plant(D1) + division(D2) + line(D3) + 0(D4)
        e.g. Plant 9, Division 6 (Paintshop), Line 1 -> 9610
        If occupied, auto-increments to 9611, 9612...
        """
        base = int(f"{plant}{division}{line}0")
        candidate = base

        # Check against existing registered instances and live host ports
        allocated_ports = {inst["port"] for inst in self.registry["instances"].values()}

        while candidate in allocated_ports or self.is_port_in_use(candidate):
            candidate += 1
            if candidate > base + 9:
                # If 10 instances on same line, shift to 9000-range
                candidate = 9700
                while candidate in allocated_ports or self.is_port_in_use(candidate):
                    candidate += 1
                break

        return candidate

    def register_instance(self, instance_id, data):
        self.registry["instances"][instance_id] = data
        self._save_registry()

    def unregister_instance(self, instance_id):
        if instance_id in self.registry["instances"]:
            del self.registry["instances"][instance_id]
            self._save_registry()

    def get_all_instances(self):
        return self.registry.get("instances", {})

    def get_port_matrix(self):
        """Returns a comprehensive visual map of ports and plant occupancy"""
        matrix = []
        plants = self.registry.get("plants", {})
        instances = self.registry.get("instances", {})

        for p_id, p_info in plants.items():
            plant_data = {
                "plant_id": p_id,
                "name": p_info["name"],
                "storage_port": p_info["storage_port"],
                "storage_online": self.is_port_in_use(p_info["storage_port"]),
                "instances": []
            }

            for inst_id, inst in instances.items():
                if str(inst.get("plant")) == str(p_id):
                    is_live = self.is_port_in_use(inst["port"])
                    inst_copy = dict(inst)
                    inst_copy["is_live"] = is_live
                    plant_data["instances"].append(inst_copy)

            matrix.append(plant_data)

        return matrix
