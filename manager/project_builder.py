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

# Official TVS Motor Company SVG Vector paths (White typography for dark theme headers)
TVS_SVG_PATHS_WHITE = (
    '<path d="M5.7302 21.8458H2.84895L1.72575 25.9985H15.6925L16.7669 21.8458H13.3973L16.7669 8.02006H19.0621L18.8668 10.3162H23.7014L25.6548 3.03691H2.40944L0.504883 10.3162H5.53487L6.5604 7.9712H9.05097L5.7302 21.8458ZM42.1609 3.03691H52.9534L38.5472 25.9985H29.5127L28.243 7.18953H26.3873L27.4617 3.03691H39.4262L38.3518 7.18953H36.3008L36.2519 18.9634L43.1376 7.18953H40.8424L42.1609 3.03691ZM69.8503 9.82767C69.8503 7.53151 70.5828 5.47963 71.5107 3.3789C67.4574 2.64608 63.0622 2.35295 59.0578 3.3789C56.8114 3.96515 54.4673 5.38192 53.1976 7.38495C51.7326 9.63225 52.0744 12.5147 53.8813 14.42C54.8092 15.3482 55.9324 15.9833 57.1044 16.5207C58.0323 16.9604 59.6438 17.6444 59.888 18.7192C60.5717 21.455 56.1765 21.6993 54.4673 21.1619V19.0123H49.8768L48.1188 25.4122C52.2209 26.4381 56.5184 26.7801 60.6693 25.8519C63.1599 25.2656 65.4063 23.9954 67.0667 21.9924C68.4341 20.2825 69.2154 17.107 67.7504 15.2505C66.9202 14.2246 65.9923 13.4429 64.8691 12.8078C63.7948 12.1727 62.6227 11.7818 61.646 11.049C60.474 10.1696 60.474 8.80173 61.7437 8.02006C62.7204 7.38495 64.3319 7.67808 65.4063 7.87349L65.6016 9.77881H69.8503V9.82767Z" fill="#FFFFFF"/>'
    '<path d="M132.845 3.47782C130.94 2.745 129.133 2.79386 127.18 3.2824C125.275 3.77094 123.908 4.84574 122.394 6.01824C120.88 7.19075 119.269 8.36325 117.511 9.14492C115.704 9.92659 113.653 10.7571 111.699 9.97544C113.116 10.0243 114.434 9.73117 115.655 8.9495C116.583 8.36325 118.194 7.14189 118.536 6.01824H116.925C118.097 4.74803 119.562 3.77094 121.173 3.18469L120.392 2.25646C122.541 0.79083 124.885 0.106869 127.473 0.00916019C128.694 -0.0396941 129.915 0.106869 131.038 0.448849C132.259 0.790829 133.187 1.37708 134.066 2.25646L132.845 3.47782ZM101.932 8.60752C101.249 8.60752 100.663 8.65638 99.9789 8.85179C99.3441 9.04721 98.7581 9.29148 98.1232 9.53575C96.9512 10.0243 95.828 10.6594 94.7048 11.2457C94.2164 11.4899 93.6304 11.7831 93.0932 11.8808C92.5072 11.9785 91.7259 11.9785 91.1887 11.7342C90.6027 11.4411 90.1143 11.1479 89.626 10.7083C89.1376 10.2686 88.6493 9.82888 88.1609 9.4869C87.6237 9.14492 87.0866 8.90065 86.5494 8.55867C86.7936 8.55867 88.0633 8.50981 87.7214 7.97242C87.4284 7.53273 86.7447 7.33731 86.2075 7.2396C84.9867 6.99533 83.7658 6.99533 82.5449 6.99533C83.5705 6.11595 84.6937 5.67626 86.061 5.67626C87.3307 5.67626 88.3563 6.26251 89.4306 6.89762C89.9678 7.2396 90.6027 7.82585 91.1398 8.16783C91.677 8.50981 92.263 8.70523 92.8491 8.90065C93.9723 9.29148 95.3885 9.09607 96.5117 8.70523C97.4395 8.36325 98.2697 7.97242 99.2953 7.97242C100.223 7.82585 101.102 8.07012 101.932 8.60752Z" fill="#E62D38"/>'
    '<path d="M92.3615 18.4234C94.3638 18.3257 96.0242 16.3716 97.1474 14.9059C98.3682 13.3426 99.1984 10.9976 101.103 10.1182C103.935 8.848 106.914 9.9228 109.503 11.2907C111.944 12.5121 115.363 12.3167 117.804 11.2419C120.49 10.0694 122.541 8.06633 124.837 6.35643C126.985 4.74424 129.769 3.62059 133.09 4.49997L134.555 2.74121L134.848 5.62362L140.024 10.851L138.999 12.0724H135.678V11.2419C134.701 10.5579 133.676 10.0694 132.455 10.2159C131.185 10.3625 129.818 10.9487 130.013 12.4632C130.16 13.4892 131.625 14.4174 132.357 14.9548C133.383 15.6388 134.457 16.2739 135.531 16.9578C137.729 18.3257 139.829 19.8402 141.88 21.4524C143.785 22.9669 145.738 24.5302 147.203 26.4356L142.71 25.5562C143.54 24.9699 142.564 24.3348 142.027 23.8951C141.343 23.3577 140.659 22.918 139.878 22.4784C138.364 21.6478 136.752 21.2081 135.092 20.8173C131.918 20.0356 127.816 19.5471 125.032 21.5501C124.934 21.599 124.837 21.6967 124.739 21.7455L123.176 20.4265C118.146 22.1364 112.53 21.6967 107.891 19.1563C105.986 20.4753 103.789 20.7685 101.591 21.0127C99.4914 21.257 97.2939 21.1104 95.1451 20.915C90.0175 25.1653 83.0341 27.6569 76.4902 25.4096L80.8854 24.286V25.2631C85.6223 25.2631 89.578 21.941 92.3615 18.4234Z" fill="#E62D38"/>'
)

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

    # Format headline text as requested: "Plant X <Title> Monitoring Dashboard"
    line_display = line_name.upper() if line_name else "LINE"
    headline_text = f"Plant {plant_id} {line_display} Monitoring Dashboard"
    if project_name and project_name.strip():
        p_clean = project_name.strip()
        if "dashboard" in p_clean.lower():
            headline_text = p_clean
        else:
            headline_text = f"Plant {plant_id} {p_clean} Monitoring Dashboard"

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
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("name", json.dumps(headline_text)))
    
    # Required FuxaServer device (id: '0')
    fuxa_server_dev = {"id": "0", "name": "FUXA Server", "type": "FuxaServer", "property": {}}
    cur.execute("INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
                ("server", json.dumps(fuxa_server_dev), "", "", ""))

    general_data = {
        "version": "1.00",
        "title": headline_text,
        "header": {
            "title": headline_text,
            "alarms": True,
            "login": True
        }
    }
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("general", json.dumps(general_data)))

    # Default FUXA Navigation & Centered Top Header Layout with Headline & TVS Logo
    view_id = "view_overview"
    layout_data = {
        "start": view_id,
        "navigation": {
            "mode": "fix",
            "type": "inline",
            "items": [
                {"icon": "home", "view": view_id, "link": "", "text": "Overview"}
            ]
        },
        "header": {
            "title": headline_text,
            "alarms": "item.notifymode-fix",
            "infos": "item.notifymode-fix",
            "bkcolor": "#0f172a",
            "fgcolor": "#ffffff",
            "height": 48,
            "fontSize": 15,
            "itemsAnchor": "center",
            "items": [
                {
                    "id": "header_headline",
                    "type": "label",
                    "text": headline_text,
                    "property": {
                        "text": headline_text
                    },
                    "marginLeft": 12,
                    "marginRight": 12,
                    "height": 34,
                    "bkcolor": "transparent",
                    "fgcolor": "#ffffff"
                }
            ]
        }
    }
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("layout", json.dumps(layout_data)))

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

    # 3. Create Default HMI View with Top Header Card & TVS Logo Emblem
    svg_header = (
        f'<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">'
        f'<g><title>Overview Layer</title>'
        f'<rect width="1920" height="1080" fill="#0f172a"/>'
        f'<rect x="20" y="20" width="1880" height="88" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>'
        f'<g id="tvs_logo_emblem" transform="translate(42, 46)">'
        f'<svg width="180" height="36" viewBox="0.5 0 146.7 26.44">'
        f'{TVS_SVG_PATHS_WHITE}'
        f'</svg>'
        f'</g>'
        f'<line x1="245" y1="36" x2="245" y2="92" stroke="#475569" stroke-width="1.5"/>'
        f'<text fill="#ffffff" font-size="24" font-family="system-ui, sans-serif" font-weight="700" x="265" y="60">'
        f'{headline_text}</text>'
        f'<text fill="#10b981" font-size="13" font-family="system-ui, sans-serif" font-weight="600" x="265" y="84">'
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

    # 4. Provision instance common resources folder with TVS Logo
    common_img_dir = os.path.join(target_dir, "_images", "Common")
    os.makedirs(common_img_dir, exist_ok=True)
    src_common = os.path.join(os.path.dirname(__file__), "..", "fuxa", "server", "_images", "Common")
    if os.path.exists(src_common):
        for item in os.listdir(src_common):
            s = os.path.join(src_common, item)
            d = os.path.join(common_img_dir, item)
            if os.path.isfile(s):
                import shutil
                shutil.copy2(s, d)

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
