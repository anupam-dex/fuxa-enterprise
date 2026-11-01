#!/usr/bin/env python3
"""
End-to-End System Test
Verifies:
1. OPC-UA Central Storage Bridge tag browsing
2. Port calculation (e.g. 9610)
3. FUXA SQLite project pre-provisioning
4. Nginx configuration generation
"""

import sys
import os
import asyncio
import sqlite3
import json

sys.path.append(os.path.join(os.path.dirname(__file__), "manager"))
sys.path.append(os.path.join(os.path.dirname(__file__), "bridge"))

from port_engine import PortEngine
from project_builder import generate_fuxa_database
from nginx.fuxa_route_generator import generate_nginx_conf
from asyncua import Client

async def test_opcua_client():
    print("--- [1/4] Testing OPC-UA Central Bridge ---")
    url = "opc.tcp://127.0.0.1:4845/fuxa/server/"
    print(f"Connecting to {url}...")
    try:
        async with Client(url=url) as client:
            root = client.nodes.root
            objects = client.nodes.objects
            print("Connected to OPC-UA Bridge successfully!")
            
            # Browse Objects
            children = await objects.get_children()
            print(f"Discovered {len(children)} top-level nodes in OPC-UA:")
            for child in children:
                name = await child.read_browse_name()
                print(f"  📁 Node: {name.Name}")
                
            # Drill down into Plant_9
            plant9 = await objects.get_child(["2:Plant_9"])
            print(f"Found {plant9}!")
            paintshop = await plant9.get_child(["2:Paintshop_Division_6"])
            oven = await paintshop.get_child(["2:Oven_Line_1"])
            temp_var = await oven.get_child(["2:Zone1_Temperature_C"])
            val = await temp_var.read_value()
            print(f"  🏷️ Successfully read tag 'Zone1_Temperature_C': {val} °C")
            print("PASSED: OPC-UA Tag Browsing & Live Value Streaming!\n")
            return True
    except Exception as e:
        print(f"OPC-UA connection test error: {e}")
        return False

def test_port_engine():
    print("--- [2/4] Testing Deterministic Port Engine ---")
    engine = PortEngine("/tmp/test_registry.json")
    port = engine.calculate_port(plant=9, division=6, line=1)
    print(f"Calculated Port for Plant 9, Division 6, Line 1: {port}")
    assert port == 9610, f"Expected 9610, got {port}"

    # Simulate collision
    engine.register_instance("dummy_9610", {"port": 9610, "plant": 9})
    port_next = engine.calculate_port(plant=9, division=6, line=1)
    print(f"Calculated Next Port after collision on 9610: {port_next}")
    assert port_next == 9611, f"Expected 9611, got {port_next}"
    print("PASSED: Port calculation and collision avoidance!\n")

def test_project_builder():
    print("--- [3/4] Testing Pre-Provisioned FUXA SQLite Database ---")
    test_dir = "/tmp/test_fuxa_view_9610"
    db_file = generate_fuxa_database(test_dir, 9, "Paintshop", "Line 1")
    assert os.path.exists(db_file), "Database file not created"

    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    cur.execute("SELECT value FROM devices WHERE name='dev_opcua_plant_9';")
    row = cur.fetchone()
    assert row is not None, "OPC-UA device was not inserted!"
    
    device_data = json.loads(row[0])
    print(f"Pre-configured Device in FUXA: {device_data['name']} (Type: {device_data['type']})")
    print(f"Target OPC-UA Endpoint: {device_data['property']['address']}")
    print(f"Pre-populated Storage Tags: {len(device_data.get('tags', {}))}")
    assert device_data['type'] == 'OPCUA'
    assert device_data['property']['address'] == 'opc.tcp://127.0.0.1:4845/fuxa/server/'
    assert len(device_data.get('tags', {})) == 11, f"Expected 11 tags, got {len(device_data.get('tags', {}))}"

    # Verify no Modbus/S7 devices exist
    cur.execute("SELECT count(*) FROM devices;")
    total_devs = cur.fetchone()[0]
    print(f"Total devices in View Server: {total_devs} (Only FUXA server & central storage OPC-UA bridge)")
    assert total_devs == 2  # server + dev_opcua_plant_9

    conn.close()
    print("PASSED: SQLite project file generated with zero PLC coupling!\n")

def test_nginx_gen():
    print("--- [4/4] Testing Nginx Route & Subpath Generator ---")
    conf_path, subpath = generate_nginx_conf(9, 6, 1, 9610, "Paintshop Line 1", "/tmp/nginx_test")
    print(f"Generated Nginx Config: {conf_path}")
    print(f"Generated OT Subpath: {subpath}")
    assert subpath == "/p9/div6/l1"
    with open(conf_path) as f:
        content = f.read()
        assert "proxy_pass http://127.0.0.1:9610/socket.io/;" in content
        assert "proxy_read_timeout 86400s;" in content
    print("PASSED: Nginx WebSockets & subpath route generator!\n")

if __name__ == "__main__":
    test_port_engine()
    test_project_builder()
    test_nginx_gen()
    print("Unit tests completed successfully!")
