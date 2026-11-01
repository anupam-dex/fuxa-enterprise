#!/usr/bin/env python3
"""
FUXA Project Builder
Pre-provisions SQLite database (project.fuxap.db) with:
- Dedicated OPC-UA connection to the Central Storage Server (opc.tcp://127.0.0.1:4845/fuxa/server/)
- Auto-populated Plant Storage tags in the OPC-UA device
- Zero direct PLC devices (Modbus/S7 disabled on View servers)
- Historical logging disabled (delegated to Storage Master)
- Clean default layout with pre-styled industrial overview view
"""

import sqlite3
import json
import os
import glob
import uuid

DEFAULT_OPCUA_ENDPOINT = "opc.tcp://127.0.0.1:4845/fuxa/server/"

# Standard industrial tags catalog for each plant
PLANT_STORAGE_TAGS_CATALOG = {
    1: {  # Plant 1 - Foundry & Powerhouse
        "Boiler_House": {
            "Boiler_01": [
                ("Steam_Pressure_Bar", 10.5, "number", "Steam Pressure (Bar)"),
                ("Steam_Temp_C", 185.0, "number", "Steam Temperature (°C)"),
                ("Burner_Status", True, "boolean", "Boiler Burner Status")
            ],
            "Feed_Water_Pump": [
                ("Flow_Rate_M3H", 45.2, "number", "Feed Water Flow Rate (m³/h)"),
                ("Pump_Running", True, "boolean", "Feed Water Pump State")
            ]
        }
    },
    2: {  # Plant 2 - Stamping & Press
        "Stamping_Shop": {
            "Press_Line_A": [
                ("Tonnage_Ton", 850.0, "number", "Main Ram Tonnage (Ton)"),
                ("Cycle_Count", 14200.0, "number", "Press Cycle Count"),
                ("Clutch_Engaged", True, "boolean", "Flywheel Clutch State")
            ]
        }
    },
    3: {  # Plant 3 - Body & Assembly
        "Assembly_Shop": {
            "Conveyor_Main": [
                ("Line_Speed_MPM", 12.5, "number", "Conveyor Line Speed (m/min)"),
                ("E_Stop_Active", False, "boolean", "Emergency Stop Line Circuit"),
                ("Takt_Time_Sec", 58.0, "number", "Takt Time Target (s)")
            ]
        }
    },
    4: {  # Plant 4 - Powertrain & Engine
        "Facility_Utilities": {
            "Chiller_Line_1": [
                ("Chiller_Temp_C", 7.2, "number", "Chilled Water Supply (°C)"),
                ("Compressor_Current_A", 145.0, "number", "Compressor Current Draw (A)"),
                ("Chiller_Running", True, "boolean", "Chiller Active State")
            ],
            "Air_Compressor": [
                ("Header_Pressure_Bar", 7.8, "number", "Main Air Header Pressure (Bar)"),
                ("Motor_Speed_RPM", 1750.0, "number", "Compressor Motor Speed (RPM)")
            ]
        }
    },
    9: {  # Plant 9 - Paintshop Complex
        "Paintshop_Division_6": {
            "Oven_Line_1": [
                ("Zone1_Temperature_C", 165.2, "number", "Curing Oven Zone 1 Temp (°C)"),
                ("Zone2_Temperature_C", 178.4, "number", "Curing Oven Zone 2 Temp (°C)"),
                ("Exhaust_Fan_Running", True, "boolean", "Exhaust Draft Fan State"),
                ("Oven_Burner_Fault", False, "boolean", "Burner Flame Safety Status")
            ],
            "Spray_Booth_Line_1": [
                ("Booth_Static_Pressure_Pa", 25.0, "number", "Spray Booth Air Balance (Pa)"),
                ("Paint_Flow_CC_Min", 350.0, "number", "Atomizer Paint Delivery (cc/min)"),
                ("Robot_Armed", True, "boolean", "Bell Applicator Robot Armed"),
                ("Downdraft_Velocity_MPS", 0.45, "number", "Booth Downdraft Airflow (m/s)")
            ],
            "Pre_Treatment_Line_1": [
                ("Degreasing_Tank_Temp_C", 55.0, "number", "Alkaline Degreasing Temp (°C)"),
                ("Rinse_Tank_pH", 7.2, "number", "Demineralized Rinse Water pH"),
                ("Circulation_Pump_Running", True, "boolean", "Dip Tank Circulation Pump State")
            ]
        }
    }
}

def get_storage_tags_for_plant(plant_id: int, division_name: str = None, base_dir: str = None) -> dict:
    """
    Extracts all tags configured on the plant's Storage Server and from the standard industrial catalog.
    Returns dictionary of tag definitions formatted for FUXA devices table.
    """
    plant_id = int(plant_id)
    tags_map = {}

    # 1. Load from default catalog
    plant_catalog = PLANT_STORAGE_TAGS_CATALOG.get(plant_id, {})
    plant_key = f"Plant_{plant_id}"

    for div_key, machines in plant_catalog.items():
        for machine_key, tag_list in machines.items():
            for item in tag_list:
                t_name, init_val, t_type = item[0], item[1], item[2]
                t_label = item[3] if len(item) > 3 else t_name.replace("_", " ")
                
                # Deterministic NodeId matching bridge/opcua_bridge.py
                opcua_address = f"ns=2;s={plant_key}.{div_key}.{machine_key}.{t_name}"
                tag_id = f"tag_p{plant_id}_{t_name}"

                tags_map[tag_id] = {
                    "id": tag_id,
                    "name": t_name,
                    "label": t_label,
                    "type": t_type,
                    "address": opcua_address,
                    "description": f"Storage Server tag from {machine_key} ({div_key})"
                }

    # 2. Check if the Plant's Storage Server has dynamic tags stored in its SQLite database
    search_dirs = []
    if base_dir:
        search_dirs.append(os.path.join(base_dir, "instances"))
    # Also check relative to this file
    search_dirs.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "instances")))

    for s_dir in search_dirs:
        pattern = os.path.join(s_dir, f"storage_plant_{plant_id}_*", "project.fuxap.db")
        matches = glob.glob(pattern)
        for db_file in matches:
            if os.path.exists(db_file):
                try:
                    conn = sqlite3.connect(db_file)
                    cur = conn.cursor()
                    cur.execute("SELECT name, value FROM devices;")
                    for d_name, d_val in cur.fetchall():
                        if d_name == "server":
                            continue
                        try:
                            dev = json.loads(d_val)
                            dev_tags = dev.get("tags", {})
                            dev_title = dev.get("name", d_name)
                            for s_tag_id, s_tag in dev_tags.items():
                                tag_name = s_tag.get("name", s_tag_id)
                                tag_type = s_tag.get("type", "number")
                                tag_label = s_tag.get("label", tag_name.replace("_", " "))
                                # Use existing address or assign deterministic address
                                addr = s_tag.get("address") or f"ns=2;s={plant_key}.{dev_title}.{tag_name}"
                                combined_id = f"tag_p{plant_id}_{tag_name}"
                                tags_map[combined_id] = {
                                    "id": combined_id,
                                    "name": tag_name,
                                    "label": tag_label,
                                    "type": tag_type,
                                    "address": addr,
                                    "description": f"Storage Server dynamic tag from {dev_title}"
                                }
                        except Exception:
                            pass
                    conn.close()
                except Exception:
                    pass

    return tags_map

def generate_fuxa_database(
    target_dir: str,
    plant_id: int,
    division_name: str,
    line_name: str,
    project_name: str = None,
    opcua_endpoint: str = DEFAULT_OPCUA_ENDPOINT,
    base_dir: str = None
) -> str:
    """
    Creates project.fuxap.db for a View Server with:
    - Dedicated Project Name in general table
    - Pre-configured OPC-UA device dev_opcua_plant_{plant_id}
    - Pre-populated storage server tags
    - Default overview view with visual header
    """
    os.makedirs(target_dir, exist_ok=True)
    db_path = os.path.join(target_dir, "project.fuxap.db")

    proj_title = (project_name.strip() if project_name and project_name.strip() 
                  else f"Plant {plant_id} - {division_name} ({line_name})")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Create FUXA core tables (all 12 required by prjstorage.js)
    cur.execute("CREATE TABLE IF NOT EXISTS general (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS views (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS devices (name TEXT PRIMARY KEY, value TEXT, connection TEXT, cntid TEXT, cntpwd TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS devicesSecurity (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS texts (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS alarms (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS recipes (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS notifications (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS scripts (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS reports (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS locations (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS arMarkers (name TEXT PRIMARY KEY, value TEXT);")

    # 1. General settings, version & explicit Project Name
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("version", "1.00"))
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("name", json.dumps(proj_title)))
    
    # Required FuxaServer device (id: '0')
    fuxa_server_dev = {"id": "0", "name": "FUXA Server", "type": "FuxaServer", "property": {}}
    cur.execute("INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
                ("server", json.dumps(fuxa_server_dev), "", "", ""))

    general_data = {
        "version": "1.00",
        "title": proj_title,
        "header": {
            "title": proj_title,
            "alarms": True,
            "login": True
        }
    }
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("general", json.dumps(general_data)))

    # 2. Extract and pre-populate all Storage Server tags for this Plant
    storage_tags = get_storage_tags_for_plant(plant_id, division_name, base_dir=base_dir)

    # Pre-configure OPC-UA Storage Device
    device_id = f"dev_opcua_plant_{plant_id}"
    device_obj = {
        "id": device_id,
        "name": f"Plant_{plant_id}_Storage_OPCUA",
        "type": "OPCUA",
        "enabled": True,
        "property": {
            "address": opcua_endpoint,
            "options": {
                "securityMode": "None",
                "securityPolicy": "None"
            }
        },
        "tags": storage_tags
    }
    cur.execute(
        "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
        (device_id, json.dumps(device_obj), "opc-ua", "", "")
    )

    # 3. Create Default HMI View with Header
    view_id = "view_overview"
    svg_header = (
        f'<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">'
        f'<g><title>Overview Layer</title>'
        f'<rect width="1920" height="1080" fill="#0f172a"/>'
        f'<rect x="20" y="20" width="1880" height="80" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>'
        f'<text fill="#38bdf8" font-size="26" font-family="system-ui, sans-serif" font-weight="700" x="50" y="62">'
        f'{proj_title}</text>'
        f'<text fill="#10b981" font-size="14" font-family="system-ui, sans-serif" font-weight="600" x="50" y="86">'
        f'🟢 Central Storage Bridge Active (:4845) &bull; {len(storage_tags)} Storage Tags Ingested &bull; Plant {plant_id} ({line_name})</text>'
        f'</g></svg>'
    )
    view_obj = {
        "id": view_id,
        "name": f"{line_name.replace(' ', '_')}_Overview",
        "profile": {
            "width": 1920,
            "height": 1080,
            "bkcolor": "#0f172a",
            "margin": 10
        },
        "items": {},
        "svgcontent": svg_header
    }
    cur.execute("INSERT OR REPLACE INTO views (name, value) VALUES (?, ?);", (view_id, json.dumps(view_obj)))

    conn.commit()
    conn.close()
    return db_path

def sync_tags_to_view_database(target_dir: str, plant_id: int, base_dir: str = None) -> dict:
    """
    Syncs the latest Plant Storage Server tags into an existing View Server SQLite database.
    Preserves existing user tags and layouts while ensuring all Storage tags are up to date.
    """
    db_path = os.path.join(target_dir, "project.fuxap.db")
    if not os.path.exists(db_path):
        return {}

    storage_tags = get_storage_tags_for_plant(plant_id, base_dir=base_dir)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    device_id = f"dev_opcua_plant_{plant_id}"
    cur.execute("SELECT value, connection, cntid, cntpwd FROM devices WHERE name = ?;", (device_id,))
    row = cur.fetchone()

    if row:
        dev_obj = json.loads(row[0])
        existing_tags = dev_obj.get("tags", {})
        # Merge storage tags
        for t_id, t_data in storage_tags.items():
            existing_tags[t_id] = t_data
        dev_obj["tags"] = existing_tags
        # Ensure endpoint is correct
        if "property" not in dev_obj or not dev_obj["property"]:
            dev_obj["property"] = {}
        dev_obj["property"]["address"] = DEFAULT_OPCUA_ENDPOINT
        dev_obj["enabled"] = True

        cur.execute("UPDATE devices SET value = ? WHERE name = ?;", (json.dumps(dev_obj), device_id))
    else:
        dev_obj = {
            "id": device_id,
            "name": f"Plant_{plant_id}_Storage_OPCUA",
            "type": "OPCUA",
            "enabled": True,
            "property": {
                "address": DEFAULT_OPCUA_ENDPOINT,
                "options": {
                    "securityMode": "None",
                    "securityPolicy": "None"
                }
            },
            "tags": storage_tags
        }
        cur.execute(
            "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
            (device_id, json.dumps(dev_obj), "opc-ua", "", "")
        )

    conn.commit()
    conn.close()
    return storage_tags

def update_project_name_in_db(db_path: str, new_name: str) -> bool:
    """
    Updates the project name directly inside FUXA SQLite database (general table: 'name' and 'general' title).
    """
    if not os.path.exists(db_path):
        return False
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS general (name TEXT PRIMARY KEY, value TEXT);")
        # 1. Update project name
        cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("name", json.dumps(new_name)))
        # 2. Update general header title
        cur.execute("SELECT value FROM general WHERE name = 'general';")
        row = cur.fetchone()
        if row:
            try:
                g = json.loads(row[0])
                g["title"] = new_name
                if "header" in g and isinstance(g["header"], dict):
                    g["header"]["title"] = new_name
                cur.execute("UPDATE general SET value = ? WHERE name = 'general';", (json.dumps(g),))
            except Exception:
                pass
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating project name in DB: {e}")
        return False

if __name__ == "__main__":
    test_dir = "/tmp/fuxa_test_appdata"
    db = generate_fuxa_database(test_dir, 9, "Paintshop", "Line 1")
    tags = sync_tags_to_view_database(test_dir, 9)
    print(f"Generated clean FUXA database at: {db}")
    print(f"Total synced tags: {len(tags)}")
    for tid, t in list(tags.items())[:3]:
        print(f"  - {tid}: {t['name']} -> {t['address']}")
