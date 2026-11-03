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
        self.persistent_path = os.path.join(os.path.dirname(__file__), "..", "instances", "registry.json")
        self.registry = self._load_registry()

    def _default_registry(self):
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

    def _load_registry(self):
        data = self._default_registry()

        # Helper to safely load JSON
        def safe_load(fpath):
            if not os.path.exists(fpath):
                return None
            try:
                with open(fpath, "r") as f:
                    content = f.read().strip()
                    if content:
                        return json.loads(content)
            except Exception:
                pass
            return None

        # 1. Load from manager/registry.json
        reg = safe_load(self.registry_path)
        if reg:
            if "plants" in reg: data["plants"] = reg["plants"]
            if "divisions" in reg: data["divisions"] = reg["divisions"]
            if "instances" in reg: data["instances"].update(reg["instances"])

        # 2. Merge from protected persistent file (instances/registry.json, never overwritten by git)
        saved = safe_load(self.persistent_path)
        if saved and "instances" in saved and saved["instances"]:
            data["instances"].update(saved["instances"])

        # 3. Deduplicate by port to prevent dual registration (e.g. port_9610 and fuxa_p9_d6_l1_9610)
        port_to_inst = {}
        for inst_id, inst in list(data["instances"].items()):
            p_num = inst.get("port")
            if not p_num:
                continue
            try:
                p_num = int(p_num)
            except Exception:
                continue
            
            p_str = str(p_num)
            plant_id = int(inst.get("plant") or (p_str[0] if len(p_str) >= 4 else 9))
            div_id = int(inst.get("division") or (p_str[1] if len(p_str) >= 4 else 6))
            line_id = int(inst.get("line") or (p_str[2] if len(p_str) >= 4 else 1))
            canonical_id = f"fuxa_p{plant_id}_d{div_id}_l{line_id}_{p_num}"

            if p_num not in port_to_inst:
                inst["id"] = canonical_id
                inst["port"] = p_num
                inst["plant"] = plant_id
                inst["division"] = div_id
                inst["line"] = line_id
                port_to_inst[p_num] = (canonical_id, inst)
            else:
                # Merge duplicate info into canonical instance
                c_id, existing = port_to_inst[p_num]
                if inst.get("subpath") and not existing.get("subpath"):
                    existing["subpath"] = inst["subpath"]
                if inst.get("name") and ("Line" in existing.get("name", "") or not existing.get("name")):
                    existing["name"] = inst["name"]
                if inst.get("work_dir") and not existing.get("work_dir"):
                    existing["work_dir"] = inst["work_dir"]

        # Rebuild instances map with only canonical keys
        data["instances"] = {c_id: inst for p, (c_id, inst) in port_to_inst.items()}

        # 3. Auto-discover existing instance directories on disk
        instances_dir = os.path.join(os.path.dirname(__file__), "..", "instances")
        if os.path.exists(instances_dir):
            import glob
            for p_dir in glob.glob(os.path.join(instances_dir, "port_*")):
                if not os.path.isdir(p_dir):
                    continue
                dirname = os.path.basename(p_dir)
                try:
                    port_num = int(dirname.replace("port_", ""))
                except Exception:
                    continue

                # Check if this port is already in instances
                found_key = None
                for k, v in data["instances"].items():
                    if v.get("port") == port_num:
                        found_key = k
                        break

                port_str = str(port_num)
                plant_id = int(port_str[0]) if len(port_str) >= 4 else 9
                div_id = int(port_str[1]) if len(port_str) >= 4 else 6
                line_id = int(port_str[2]) if len(port_str) >= 4 else 1

                # Read project name from SQLite database if available
                proj_name = None
                db_path = os.path.join(p_dir, "project.fuxap.db")
                if os.path.exists(db_path):
                    try:
                        import sqlite3
                        conn = sqlite3.connect(db_path)
                        cur = conn.cursor()
                        cur.execute("SELECT * FROM general")
                        for k, v in cur.fetchall():
                            if k == "name" and v:
                                try:
                                    proj_name = json.loads(v)
                                except Exception:
                                    proj_name = v.strip('"')
                            elif k == "general" and v and not proj_name:
                                try:
                                    g_data = json.loads(v)
                                    if g_data.get("title"):
                                        proj_name = g_data["title"]
                                except Exception:
                                    pass
                        conn.close()
                    except Exception:
                        pass

                if not found_key:
                    inst_id = f"fuxa_p{plant_id}_d{div_id}_l{line_id}_{port_num}"
                    subpath = f"/p{plant_id}/div{div_id}/l{line_id}"
                    data["instances"][inst_id] = {
                        "id": inst_id,
                        "name": proj_name or f"Plant {plant_id} Line {line_id}",
                        "plant": plant_id,
                        "division": div_id,
                        "line": line_id,
                        "port": port_num,
                        "subpath": subpath,
                        "work_dir": os.path.abspath(p_dir),
                        "status": "RUNNING" if self.is_port_in_use(port_num) else "STOPPED",
                        "editor_url": f"{subpath}/editor",
                        "home_url": f"{subpath}/home"
                    }
                else:
                    # Update existing entry with any missing metadata
                    target = data["instances"][found_key]
                    if not target.get("plant"): target["plant"] = plant_id
                    if not target.get("division"): target["division"] = div_id
                    if not target.get("line"): target["line"] = line_id
                    if proj_name and not target.get("name"): target["name"] = proj_name
                    if not target.get("work_dir"): target["work_dir"] = os.path.abspath(p_dir)

        # 4. Enforce valid plant, division, line on all instances
        for inst_id, inst in list(data["instances"].items()):
            p_num = inst.get("port")
            if p_num:
                p_str = str(p_num)
                if not inst.get("plant"):
                    inst["plant"] = int(p_str[0]) if len(p_str) >= 4 else 9
                if not inst.get("division"):
                    inst["division"] = int(p_str[1]) if len(p_str) >= 4 else 6
                if not inst.get("line"):
                    inst["line"] = int(p_str[2]) if len(p_str) >= 4 else 1

        return data

    def _atomic_write_json(self, fpath, obj):
        try:
            os.makedirs(os.path.dirname(os.path.abspath(fpath)), exist_ok=True)
            tmp_path = fpath + ".tmp"
            with open(tmp_path, "w") as f:
                json.dump(obj, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, fpath)
        except Exception:
            pass

    def _save_registry(self):
        # Save to manager/registry.json
        self._atomic_write_json(self.registry_path, self.registry)
        # Also save to git-ignored instances/registry.json
        self._atomic_write_json(self.persistent_path, self.registry)

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
        self.registry = self._load_registry()
        self.registry["instances"][instance_id] = data
        self._save_registry()

    def unregister_instance(self, instance_id):
        self.registry = self._load_registry()
        if instance_id in self.registry["instances"]:
            del self.registry["instances"][instance_id]
            self._save_registry()

    def get_all_instances(self):
        self.registry = self._load_registry()
        return self.registry.get("instances", {})

    def get_port_matrix(self):
        """Returns a comprehensive visual map of ports and plant occupancy"""
        self.registry = self._load_registry()
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
                inst_plant = str(inst.get("plant") or "")
                if not inst_plant:
                    p_str = str(inst.get("port", ""))
                    inst_plant = p_str[0] if len(p_str) >= 4 else "9"

                if inst_plant == str(p_id):
                    is_live = self.is_port_in_use(inst["port"])
                    inst_copy = dict(inst)
                    inst_copy["is_live"] = is_live
                    inst_copy["status"] = "RUNNING" if is_live else "STOPPED"
                    plant_data["instances"].append(inst_copy)

            matrix.append(plant_data)

        return matrix
