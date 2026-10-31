#!/usr/bin/env python3
"""
FUXA Project Builder
Pre-provisions SQLite database (project.fuxap.db) with:
- Dedicated OPC-UA connection to the Central Storage Server (opc.tcp://127.0.0.1:4840)
- Zero direct PLC devices (Modbus/S7 disabled)
- Historical logging disabled
- Clean default layout and division views
"""

import sqlite3
import json
import os
import uuid

def generate_fuxa_database(target_dir: str, plant_id: int, division_name: str, line_name: str, opcua_endpoint: str = "opc.tcp://127.0.0.1:4840"):
    os.makedirs(target_dir, exist_ok=True)
    db_path = os.path.join(target_dir, "project.fuxap.db")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Create FUXA core tables
    cur.execute("CREATE TABLE IF NOT EXISTS general (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS views (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS devices (name TEXT PRIMARY KEY, value TEXT, connection TEXT, cntid TEXT, cntpwd TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS devicesSecurity (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS texts (name TEXT PRIMARY KEY, value TEXT);")
    cur.execute("CREATE TABLE IF NOT EXISTS alarms (name TEXT PRIMARY KEY, value TEXT);")

    # 1. General settings
    general_data = {
        "version": "1.02",
        "title": f"Plant {plant_id} - {division_name} ({line_name})",
        "header": {
            "title": f"Plant {plant_id} | {division_name}",
            "alarms": True,
            "login": True
        }
    }
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("version", "1.02"))
    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("general", json.dumps(general_data)))

    # 2. Pre-configure OPC-UA Storage Device
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
        "tags": {}  # Populated via native OPC-UA "Browse Tags" in the UI
    }
    cur.execute(
        "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
        (device_id, json.dumps(device_obj), "opc-ua", "", "")
    )

    # 3. Create Default HMI View
    view_id = "view_overview"
    view_obj = {
        "id": view_id,
        "name": f"{line_name.replace(' ', '_')}_Overview",
        "profile": {
            "width": 1920,
            "height": 1080,
            "bkcolor": "#1e222d",
            "margin": 10
        },
        "items": {}
    }
    cur.execute("INSERT OR REPLACE INTO views (name, value) VALUES (?, ?);", (view_id, json.dumps(view_obj)))

    conn.commit()
    conn.close()
    return db_path

if __name__ == "__main__":
    test_dir = "/tmp/fuxa_test_appdata"
    db = generate_fuxa_database(test_dir, 9, "Paintshop", "Line 1")
    print(f"Generated clean FUXA database at: {db}")
