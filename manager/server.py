#!/usr/bin/env python3
"""
FUXA Fleet Manager - Orchestrator Web Server
Provides visual port map, wizard to create new instances, and life-cycle management.
"""

import os
import sys
import json
import time
import glob
import io
import tarfile
import shutil
import asyncio
import psutil
import subprocess
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

from port_engine import PortEngine
from project_builder import (
    generate_fuxa_database,
    sync_tags_to_view_database,
    get_storage_tags_for_plant,
    get_storage_devices_catalog,
    get_storage_devices_for_plant,
    update_project_name_in_db
)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from nginx.fuxa_route_generator import generate_nginx_conf, reload_nginx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FleetManager")

app = FastAPI(title="FUXA Fleet Manager & Visual Port Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCES_DIR = os.path.join(BASE_DIR, "instances")
FUXA_SERVER_PATH = os.path.join(BASE_DIR, "fuxa", "server", "main.js")
NGINX_CONF_DIR = os.path.join(BASE_DIR, "nginx", "conf.d")
BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)

port_engine = PortEngine()
running_processes = {}  # instance_id -> subprocess.Popen

# ==============================================================================
# OT Reliability: Automatic Process Watchdog & Self-Healing
# ==============================================================================
watchdog_state = {
    "enabled": True,
    "interval_seconds": 6,
    "last_check_timestamp": None,
    "total_checks": 0,
    "auto_recoveries": 0,
    "events": []
}

def record_watchdog_event(target: str, message: str, event_type: str = "RECOVERY"):
    event = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "target": target,
        "message": message,
        "type": event_type
    }
    watchdog_state["events"].insert(0, event)
    if len(watchdog_state["events"]) > 50:
        watchdog_state["events"].pop()
    logger.info(f"[WATCHDOG] [{event_type}] {target}: {message}")

async def process_watchdog_loop():
    """
    Continuous Industrial Process Watchdog:
    Monitors all central storage masters & distributed view servers.
    Automatically self-heals any process that stops unexpectedly.
    """
    await asyncio.sleep(10)  # Initial startup grace period
    while True:
        try:
            if watchdog_state["enabled"]:
                watchdog_state["last_check_timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
                watchdog_state["total_checks"] += 1

                # 1. Audit Central Storage Servers
                plants = port_engine.registry.get("plants", {})
                for plant_id, p_info in plants.items():
                    s_port = p_info.get("storage_port")
                    if s_port and not port_engine.is_port_in_use(s_port):
                        logger.warning(f"[WATCHDOG] Storage Master for Plant {plant_id} (: {s_port}) down! Self-healing...")
                        s_work_dir = os.path.join(INSTANCES_DIR, f"storage_plant_{plant_id}_{s_port}")
                        pid = _launch_fuxa_instance(f"storage_p{plant_id}", s_port, s_work_dir, f"/p{plant_id}/storage")
                        if pid:
                            watchdog_state["auto_recoveries"] += 1
                            record_watchdog_event(f"Storage Plant {plant_id}", f"Self-healed Storage Master process on port {s_port} (PID {pid})", "STORAGE_RECOVERED")

                # 2. Audit View Server Instances
                instances = port_engine.get_all_instances()
                for inst_id, inst in list(instances.items()):
                    if inst.get("user_stopped"):
                        continue
                    port = inst.get("port")
                    if not port:
                        continue
                    if not port_engine.is_port_in_use(port):
                        logger.warning(f"[WATCHDOG] View Server '{inst.get('name', inst_id)}' (: {port}) unexpected termination! Self-healing...")
                        work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{port}")
                        subpath = inst.get("subpath") or f"/p{inst.get('plant', 9)}/div{inst.get('division', 1)}/l{inst.get('line', 1)}"
                        pid = _launch_fuxa_instance(inst_id, port, work_dir, subpath)
                        if pid:
                            watchdog_state["auto_recoveries"] += 1
                            inst["pid"] = pid
                            inst["status"] = "RUNNING"
                            inst["restart_count"] = inst.get("restart_count", 0) + 1
                            inst["last_recovered_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                            port_engine.register_instance(inst_id, inst)
                            record_watchdog_event(inst.get("name", inst_id), f"Auto-restarted crashed View Server on port {port} (Restart #{inst['restart_count']}, PID {pid})", "VIEW_RECOVERED")
        except Exception as e:
            logger.error(f"[WATCHDOG] Error in watchdog monitor loop: {e}")

        await asyncio.sleep(watchdog_state["interval_seconds"])

def ensure_default_storage_servers():
    """Hosts central storage collector instances for each plant by default"""
    plants = port_engine.registry.get("plants", {})
    for plant_id, p_info in plants.items():
        storage_port = p_info["storage_port"]
        storage_work_dir = os.path.join(INSTANCES_DIR, f"storage_plant_{plant_id}_{storage_port}")
        os.makedirs(storage_work_dir, exist_ok=True)

        if not port_engine.is_port_in_use(storage_port):
            logger.info(f"Hosting Central Storage Server for Plant {plant_id} on Port {storage_port}...")
            db_path = os.path.join(storage_work_dir, "project.fuxap.db")
            if not os.path.exists(db_path):
                generate_fuxa_database(
                    target_dir=storage_work_dir,
                    plant_id=int(plant_id),
                    division_name=f"Central Storage Master (Plant {plant_id})",
                    line_name="PLC Collector & InfluxDB Storage",
                    opcua_endpoint="opc.tcp://127.0.0.1:4845/fuxa/server/",
                    base_dir=BASE_DIR
                )
            _launch_fuxa_instance(f"storage_p{plant_id}", storage_port, storage_work_dir, f"/p{plant_id}/storage")

@app.on_event("startup")
async def on_startup():
    logger.info("Initializing FUXA Fleet Orchestrator...")
    # 1. Host storage servers for all plants by default
    ensure_default_storage_servers()

    # 2. Auto-start 5 Soft OPC-UA Industrial Simulators for testing & lab validation
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        asyncio.create_task(soft_opc_manager.start_all())
        logger.info("Started 5 Soft OPC-UA Simulators on Ports 4850-4854")
    except Exception as e:
        logger.warning(f"Could not initialize Soft OPC-UA Simulators: {e}")

    # 3. Automatically restore, sync tags and re-launch all existing view servers
    instances = port_engine.get_all_instances()
    started_ports = set()
    for inst_id, inst in list(instances.items()):
        port = inst.get("port")
        if not port or port in started_ports:
            continue
        started_ports.add(port)

        work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{port}")
        subpath = inst.get("subpath") or f"/p{inst.get('plant', 9)}/div{inst.get('division', 1)}/l{inst.get('line', 1)}"
        plant_id = inst.get("plant", 9)

        # Pre-flight tag sync: Ensure storage server tags are injected into View Server database
        try:
            synced_tags = sync_tags_to_view_database(work_dir, plant_id, base_dir=BASE_DIR)
            inst["tag_count"] = len(synced_tags)
            port_engine.register_instance(inst_id, inst)
        except Exception as e:
            logger.warning(f"Could not auto-sync tags for {inst_id}: {e}")

        if not port_engine.is_port_in_use(port):
            logger.info(f"Auto-restoring View Server {inst_id} on Port {port} ({subpath})...")
            pid = _launch_fuxa_instance(inst_id, port, work_dir, subpath)
            inst["pid"] = pid
            inst["status"] = "RUNNING" if pid else "STOPPED"
            port_engine.register_instance(inst_id, inst)

    # 4. Start Continuous Process Watchdog & Self-Healing loop
    asyncio.create_task(process_watchdog_loop())
    logger.info("Started Automatic Process Watchdog (Continuous Self-Healing Active)")

class CreateProjectRequest(BaseModel):
    plant: int
    division: int
    line: int
    project_name: str
    custom_subpath: str = None
    custom_port: int = None

class UpdateSubpathRequest(BaseModel):
    port: int
    subpath: str
    name: str = None
    from_gateway: bool = False
    from_fuxa: bool = False

@app.post("/api/update-subpath")
def update_subpath(req: UpdateSubpathRequest):
    new_sub = "/" + req.subpath.strip("/")
    instances = port_engine.get_all_instances()
    target_work_dir = None
    target_plant = 9
    port_str = str(req.port)
    deduced_plant = int(port_str[0]) if len(port_str) >= 4 else 9
    deduced_div = int(port_str[1]) if len(port_str) >= 4 else 6
    deduced_line = int(port_str[2]) if len(port_str) >= 4 else 1
    canonical_id = f"fuxa_p{deduced_plant}_d{deduced_div}_l{deduced_line}_{req.port}"

    # Clean up any legacy or duplicate keys for this port
    for iid, i in list(instances.items()):
        if i.get("port") == req.port and iid != canonical_id:
            port_engine.unregister_instance(iid)

    instances = port_engine.get_all_instances()
    inst = instances.get(canonical_id) or {}
    inst["id"] = canonical_id
    inst["port"] = req.port
    inst["subpath"] = new_sub
    inst["editor_url"] = f"{new_sub}/editor"
    inst["home_url"] = f"{new_sub}/home"
    if req.name:
        inst["name"] = req.name
    inst["plant"] = inst.get("plant") or deduced_plant
    inst["division"] = inst.get("division") or deduced_div
    inst["line"] = inst.get("line") or deduced_line
    target_plant = inst["plant"]
    target_work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{req.port}")
    inst["work_dir"] = target_work_dir
    inst["status"] = "RUNNING" if port_engine.is_port_in_use(req.port) else "STOPPED"
    port_engine.register_instance(canonical_id, inst)

    # Persist project name directly inside FUXA SQLite DB
    if req.name and target_work_dir:
        db_path = os.path.join(target_work_dir, "project.fuxap.db")
        update_project_name_in_db(db_path, req.name)
        # Notify FUXA instance process if running
        try:
            import requests
            requests.post(f"http://127.0.0.1:{req.port}/api/project-name", json={"name": req.name, "from_manager": True}, timeout=0.5)
        except Exception:
            pass

    # Notify Embedded Gateway on Port 80
    if not req.from_gateway:
        try:
            import requests
            requests.post("http://127.0.0.1:80/api/gateway/subpath", json={"subpath": new_sub, "port": req.port, "name": req.name, "plant": target_plant, "from_manager": True}, timeout=0.5)
        except Exception:
            pass

    return {"success": True, "subpath": new_sub, "instance": inst}

@app.post("/api/instances/{instance_id}/rename")
def rename_instance(instance_id: str, req: dict):
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    inst = instances[instance_id]
    if "name" in req and req["name"]:
        inst["name"] = req["name"]
    if "plant" in req and req["plant"] is not None:
        inst["plant"] = int(req["plant"])
    if "division" in req and req["division"] is not None:
        inst["division"] = int(req["division"])
    if "line" in req and req["line"] is not None:
        inst["line"] = int(req["line"])
    if "port" in req and req["port"] is not None:
        inst["port"] = int(req["port"])
    if "subpath" in req and req["subpath"]:
        new_sub = "/" + req["subpath"].strip("/")
        inst["subpath"] = new_sub
        inst["editor_url"] = f"{new_sub}/editor"
        inst["home_url"] = f"{new_sub}/home"

    # Persist project name in SQLite database
    work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{inst.get('port')}")
    if "name" in req and req["name"]:
        db_path = os.path.join(work_dir, "project.fuxap.db")
        update_project_name_in_db(db_path, req["name"])
        # Notify running FUXA server
        try:
            import requests
            requests.post(f"http://127.0.0.1:{inst.get('port')}/api/project-name", json={"name": req["name"]}, timeout=0.3)
        except Exception:
            pass

    try:
        import requests
        requests.post("http://127.0.0.1:80/api/gateway/subpath", json={"subpath": inst.get("subpath"), "port": inst.get("port"), "name": inst.get("name")}, timeout=0.5)
    except Exception:
        pass

    port_engine.register_instance(instance_id, inst)
    return {"success": True, "instance": inst}

@app.get("/api/matrix")
def get_matrix():
    """Returns visual port map & status of all plants and assigned instances"""
    return {
        "matrix": port_engine.get_port_matrix(),
        "plants": port_engine.registry.get("plants", {}),
        "divisions": port_engine.registry.get("divisions", {}),
        "watchdog": {
            "enabled": watchdog_state["enabled"],
            "total_checks": watchdog_state["total_checks"],
            "auto_recoveries": watchdog_state["auto_recoveries"],
            "last_check": watchdog_state["last_check_timestamp"],
            "recent_events": watchdog_state["events"][:10]
        }
    }

@app.get("/api/watchdog/status")
def get_watchdog_status():
    return watchdog_state

@app.post("/api/watchdog/toggle")
def toggle_watchdog():
    watchdog_state["enabled"] = not watchdog_state["enabled"]
    record_watchdog_event("System Watchdog", f"Watchdog state toggled to {'ENABLED' if watchdog_state['enabled'] else 'PAUSED'}", "CONFIG")
    return {"enabled": watchdog_state["enabled"]}

@app.post("/api/create-project")
def create_project(req: CreateProjectRequest):
    # 1. Calculate Port (or use custom port if provided)
    if req.custom_port and req.custom_port > 1024:
        port = req.custom_port
    else:
        port = port_engine.calculate_port(req.plant, req.division, req.line)

    if port_engine.is_port_in_use(port):
        raise HTTPException(status_code=400, detail=f"Port {port} is already in use by another instance or service.")

    instance_id = f"fuxa_p{req.plant}_d{req.division}_l{req.line}_{port}"

    logger.info(f"Allocating new FUXA instance: {instance_id} on port {port}")

    # 2. Setup userDir & pre-provision project.fuxap.db with OPC-UA connection
    instance_work_dir = os.path.join(INSTANCES_DIR, f"port_{port}")
    os.makedirs(instance_work_dir, exist_ok=True)

    div_name = port_engine.registry.get("divisions", {}).get(str(req.division), f"Division_{req.division}")
    line_name = f"Line {req.line}"

    db_path = generate_fuxa_database(
        target_dir=instance_work_dir,
        plant_id=req.plant,
        division_name=div_name,
        line_name=line_name,
        project_name=req.project_name,
        opcua_endpoint="opc.tcp://127.0.0.1:4845/fuxa/server/",
        base_dir=BASE_DIR
    )

    storage_tags = get_storage_tags_for_plant(req.plant, div_name, base_dir=BASE_DIR)
    tag_count = len(storage_tags)

    # 3. Generate reverse proxy route & subpath
    if req.custom_subpath and req.custom_subpath.strip():
        subpath = "/" + req.custom_subpath.strip().strip("/")
    else:
        conf_path, subpath = generate_nginx_conf(
            plant=req.plant,
            division=req.division,
            line=req.line,
            port=port,
            project_name=req.project_name,
            output_dir=NGINX_CONF_DIR
        )
    reload_nginx()

    # 4. Launch FUXA View Server instance
    pid = _launch_fuxa_instance(instance_id, port, instance_work_dir, subpath)

    # 5. Save in persistent registry
    instance_meta = {
        "id": instance_id,
        "name": req.project_name,
        "plant": req.plant,
        "division": req.division,
        "line": req.line,
        "port": port,
        "subpath": subpath,
        "work_dir": instance_work_dir,
        "pid": pid,
        "status": "RUNNING" if pid else "STOPPED",
        "tag_count": tag_count,
        "editor_url": f"{subpath}/editor",
        "home_url": f"{subpath}/home"
    }
    port_engine.register_instance(instance_id, instance_meta)

    return {
        "success": True,
        "instance": instance_meta,
        "message": f"View Server successfully created on Port {port} with {tag_count} pre-configured Storage Server tags!"
    }

def _launch_fuxa_instance(instance_id: str, port: int, work_dir: str, subpath: str):
    """Starts the FUXA instance process with BASE_PATH and userDir"""
    if port and port_engine.is_port_in_use(port):
        logger.warning(f"Port {port} is already active and listening; skipping duplicate launch for {instance_id}.")
        return None

    # Normalize work_dir to local machine
    if not os.path.exists(work_dir):
        work_dir = os.path.join(INSTANCES_DIR, f"port_{port}")
    os.makedirs(work_dir, exist_ok=True)

    # Ensure common resources folder with TVS logo is provisioned in work_dir
    common_img_dir = os.path.join(work_dir, "_images", "Common")
    os.makedirs(common_img_dir, exist_ok=True)
    src_common = os.path.join(BASE_DIR, "fuxa", "server", "_images", "Common")
    if os.path.exists(src_common):
        for item in os.listdir(src_common):
            s = os.path.join(src_common, item)
            d = os.path.join(common_img_dir, item)
            if os.path.isfile(s):
                import shutil
                shutil.copy2(s, d)

    env = os.environ.copy()
    env["BASE_PATH"] = subpath
    env["NODE_OPTIONS"] = "--max-old-space-size=4096"

    fuxa_server_dir = os.path.dirname(FUXA_SERVER_PATH)
    cmd = ["node", FUXA_SERVER_PATH, "--port", str(port), "--userDir", work_dir]

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=fuxa_server_dir,
            env=env,
            stdout=open(os.path.join(work_dir, "fuxa.log"), "a"),
            stderr=subprocess.STDOUT
        )
        running_processes[instance_id] = proc
        logger.info(f"Started FUXA process PID {proc.pid} on port {port}")
        return proc.pid
    except FileNotFoundError:
        logger.warning("Node.js binary not directly found in PATH. Project files & database created successfully for container or service launch.")
        return None
    except Exception as e:
        logger.error(f"Error starting FUXA process: {e}")
        return None

@app.post("/api/instances/{instance_id}/stop")
def stop_instance(instance_id: str):
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")

    inst = instances[instance_id]
    pid = inst.get("pid")

    if pid and psutil.pid_exists(pid):
        try:
            p = psutil.Process(pid)
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            pass

    inst["status"] = "STOPPED"
    inst["user_stopped"] = True
    inst["pid"] = None
    port_engine.register_instance(instance_id, inst)
    return {"success": True, "status": "STOPPED"}

@app.post("/api/instances/{instance_id}/start")
def start_instance(instance_id: str):
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")

    inst = instances[instance_id]
    inst["user_stopped"] = False
    pid = _launch_fuxa_instance(instance_id, inst["port"], inst["work_dir"], inst["subpath"])
    inst["pid"] = pid
    inst["status"] = "RUNNING" if pid else "STOPPED"
    port_engine.register_instance(instance_id, inst)
    return {"success": True, "status": inst["status"], "pid": pid}

@app.delete("/api/instances/{instance_id}")
def delete_instance(instance_id: str):
    stop_instance(instance_id)
    port_engine.unregister_instance(instance_id)
    return {"success": True}

@app.post("/api/instances/{instance_id}/sync-tags")
def sync_instance_tags(instance_id: str):
    """Syncs the latest storage server tags into the view server's database and restarts if running"""
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")

    inst = instances[instance_id]
    port = inst.get("port")
    plant_id = inst.get("plant", 9)
    work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{port}")

    synced_tags = sync_tags_to_view_database(work_dir, plant_id, base_dir=BASE_DIR)
    tag_count = len(synced_tags)
    inst["tag_count"] = tag_count

    # If instance is currently running, seamlessly restart it so FUXA picks up updated tags
    was_running = inst.get("status") == "RUNNING" or port_engine.is_port_in_use(port)
    if was_running:
        logger.info(f"Restarting instance {instance_id} to activate {tag_count} synced tags...")
        stop_instance(instance_id)
        subpath = inst.get("subpath", f"/p{plant_id}/div1/l1")
        pid = _launch_fuxa_instance(instance_id, port, work_dir, subpath)
        inst["pid"] = pid
        inst["status"] = "RUNNING" if pid else "STOPPED"

    port_engine.register_instance(instance_id, inst)
    return {
        "success": True,
        "instance_id": instance_id,
        "port": port,
        "plant": plant_id,
        "tag_count": tag_count,
        "tags": list(synced_tags.keys()),
        "message": f"Successfully synced {tag_count} Plant {plant_id} Storage tags to View Server on Port {port}!"
    }

@app.post("/api/sync-all-tags")
def sync_all_tags():
    """Syncs storage server tags to all view servers across the entire fleet"""
    instances = port_engine.get_all_instances()
    synced_list = []

    for inst_id, inst in list(instances.items()):
        port = inst.get("port")
        plant_id = inst.get("plant", 9)
        work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{port}")

        try:
            synced_tags = sync_tags_to_view_database(work_dir, plant_id, base_dir=BASE_DIR)
            tag_count = len(synced_tags)
            inst["tag_count"] = tag_count

            was_running = inst.get("status") == "RUNNING" or port_engine.is_port_in_use(port)
            if was_running:
                stop_instance(inst_id)
                subpath = inst.get("subpath", f"/p{plant_id}/div1/l1")
                pid = _launch_fuxa_instance(inst_id, port, work_dir, subpath)
                inst["pid"] = pid
                inst["status"] = "RUNNING" if pid else "STOPPED"

            port_engine.register_instance(inst_id, inst)
            synced_list.append({"instance_id": inst_id, "port": port, "plant": plant_id, "tag_count": tag_count})
        except Exception as e:
            logger.error(f"Failed to sync tags for {inst_id}: {e}")

    return {
        "success": True,
        "count": len(synced_list),
        "synced_instances": synced_list,
        "message": f"Successfully synced storage tags to {len(synced_list)} view servers!"
    }

@app.get("/api/storage-devices")
@app.get("/api/storage/devices")
def api_get_storage_devices(plant: int = 9):
    """Returns available devices and tags connected to InfluxDB on Central Storage for the given plant"""
    catalog = get_storage_devices_catalog(plant, base_dir=BASE_DIR)
    return {
        "success": True,
        "plant": plant,
        "count": len(catalog),
        "devices": catalog
    }

class ConnectDeviceRequest(BaseModel):
    plant: int
    subpath: str = None
    instance_id: str = None
    device_key: str

@app.post("/api/storage-devices/connect")
@app.post("/api/storage/connect-device")
def api_connect_storage_device(req: ConnectDeviceRequest):
    """
    Directly connects/maps a Storage Server device into an instance's project.fuxap.db
    without duplicate field polling.
    """
    plant_id = req.plant
    catalog = get_storage_devices_catalog(plant_id, base_dir=BASE_DIR)
    matched_device = None
    for dev in catalog:
        if (dev["device_key"].lower() == req.device_key.lower() or 
            dev["id"].lower() == req.device_key.lower() or 
            dev["name"].lower() == req.device_key.lower()):
            matched_device = dev
            break

    if not matched_device:
        raise HTTPException(status_code=404, detail=f"Device '{req.device_key}' not found in Plant {plant_id} storage catalog.")

    # Locate instance
    target_work_dirs = []
    instances = port_engine.get_all_instances()
    if req.instance_id and req.instance_id in instances:
        inst = instances[req.instance_id]
        work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{inst.get('port')}")
        target_work_dirs.append((req.instance_id, work_dir, inst))
    elif req.subpath:
        clean_sub = '/' + req.subpath.strip('/')
        for i_id, inst in instances.items():
            inst_sub = (inst.get("subpath") or "").strip('/')
            if inst_sub and (inst_sub == clean_sub.strip('/') or clean_sub.strip('/').startswith(inst_sub)):
                work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{inst.get('port')}")
                target_work_dirs.append((i_id, work_dir, inst))
                break

    # If no instance found by ID/subpath, scan instances directory for matching plant
    if not target_work_dirs:
        import glob
        for p in glob.glob(os.path.join(INSTANCES_DIR, "port_*")):
            if os.path.isdir(p):
                target_work_dirs.append(("local", p, {}))

    for i_id, w_dir, inst in target_work_dirs:
        db_path = os.path.join(w_dir, "project.fuxap.db")
        if os.path.exists(db_path):
            try:
                import sqlite3
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute(
                    "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
                    (matched_device["id"], json.dumps(matched_device), "opc-ua", "", "")
                )
                conn.commit()
                conn.close()
                logger.info(f"Connected storage device '{matched_device['name']}' into {db_path}")
            except Exception as e:
                logger.error(f"Error connecting device into {db_path}: {e}")

    return {
        "success": True,
        "device": matched_device,
        "message": f"Successfully connected '{matched_device['name']}' ({matched_device['tag_count']} tags) from Central Storage (InfluxDB)!"
    }

@app.get("/api/instances/{instance_id}/logs")
def get_instance_logs(instance_id: str, lines: int = 100):
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")

    work_dir = instances[instance_id]["work_dir"]
    log_file = os.path.join(work_dir, "fuxa.log")
    err_file = os.path.join(work_dir, "fuxa-err.log")

    logs = []
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", errors="ignore") as f:
                logs = f.readlines()[-lines:]
        except Exception as e:
            logs = [f"Error reading log file: {e}"]

    errs = []
    if os.path.exists(err_file):
        try:
            with open(err_file, "r", errors="ignore") as f:
                errs = f.readlines()[-lines:]
        except Exception:
            pass

    return {
        "instance_id": instance_id,
        "logs": logs,
        "errors": errs
    }

@app.post("/api/build-client")
def build_client():
    client_dir = os.path.join(BASE_DIR, "fuxa", "client")
    try:
        res = subprocess.run(
            ["npm", "run", "build"],
            cwd=client_dir,
            capture_output=True,
            text=True,
            timeout=300
        )
        return {
            "success": res.returncode == 0,
            "stdout": res.stdout[-1000:],
            "stderr": res.stderr[-1000:]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# --- Soft OPC-UA Simulator APIs ---

@app.get("/api/simulator/status")
def get_simulator_status():
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        return soft_opc_manager.get_status()
    except Exception as e:
        return {"error": str(e), "is_lab_active": False, "servers": []}

@app.get("/api/simulator/{server_id}/tags")
def get_simulator_tags(server_id: str):
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        return {"server_id": server_id, "tags": soft_opc_manager.get_live_tags(server_id)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/simulator/{server_id}/start")
async def start_sim_server(server_id: str):
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        success = await soft_opc_manager.start_server(server_id)
        return {"success": success, "server_id": server_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/{server_id}/stop")
async def stop_sim_server(server_id: str):
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        success = await soft_opc_manager.stop_server(server_id)
        return {"success": success, "server_id": server_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/{server_id}/drop")
async def drop_sim_network(server_id: str, duration: int = 5):
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        success = await soft_opc_manager.drop_network(server_id, duration)
        return {"success": success, "server_id": server_id, "duration": duration}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/{server_id}/glitch")
def glitch_sim_server(server_id: str, duration: int = 6):
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        success = soft_opc_manager.glitch_server(server_id, duration)
        return {"success": success, "server_id": server_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/start-all")
async def start_all_simulators():
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        success = await soft_opc_manager.start_all()
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/stop-all")
async def stop_all_simulators():
    try:
        from simulator.soft_opcua_engine import soft_opc_manager
        await soft_opc_manager.stop_all()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/simulator/{server_id}/add-to-storage")
def add_sim_to_storage(server_id: str):
    """Maps a simulated OPC-UA server into its plant storage database for immediate acquisition"""
    from simulator.soft_opcua_engine import SIMULATOR_CONFIGS
    cfg = next((c for c in SIMULATOR_CONFIGS if c["id"] == server_id), None)
    if not cfg:
        raise HTTPException(status_code=404, detail="Simulator config not found")

    plant_id = cfg.get("plant", 9)
    storage_port = 5000 + plant_id * 100 if plant_id != 9 else 5900
    storage_work_dir = os.path.join(INSTANCES_DIR, f"storage_plant_{plant_id}_{storage_port}")
    db_file = os.path.join(storage_work_dir, "project.fuxap.db")

    if not os.path.exists(db_file):
        raise HTTPException(status_code=400, detail=f"Storage DB not found at {db_file}")

    import sqlite3
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()

    dev_id = f"dev_opc_{server_id}"
    dev_name = f"Sim_{cfg['name'].replace(' ', '_')}"
    
    # Pre-generate tags dictionary
    tags_dict = {}
    for i, t in enumerate(cfg["tags"]):
        tid = f"tag_{server_id}_{i+1}"
        tags_dict[tid] = {
            "id": tid,
            "name": t["name"],
            "type": t.get("type", "number"),
            "address": f"ns=2;s={t['name']}",
            "daq": {"enabled": True, "restored": False}
        }

    dev_obj = {
        "id": dev_id,
        "name": dev_name,
        "type": "OPCUA",
        "enabled": True,
        "property": {
            "address": cfg["client_endpoint"],
            "options": {"securityMode": "None", "securityPolicy": "None"}
        },
        "tags": tags_dict,
        "topology": {
            "plant": plant_id,
            "division": cfg.get("division", 6),
            "line": cfg.get("line", 1)
        }
    }

    cur.execute(
        "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
        (dev_id, json.dumps(dev_obj), "opc-ua", "", "")
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": f"Successfully mapped {dev_name} ({len(tags_dict)} tags) into Plant {plant_id} Storage Server (: {storage_port})!",
        "device": dev_obj
    }

# ==============================================================================
# OT Reliability: 1-Click Disaster Recovery & Backup Snapshots
# ==============================================================================
class RestoreRequest(BaseModel):
    filename: str

@app.post("/api/backup/create")
def api_create_backup():
    """Bundles SQLite DBs, plant topology, and config into a single timestamped snapshot"""
    try:
        os.makedirs(BACKUPS_DIR, exist_ok=True)
        ts_str = time.strftime("%Y%m%d_%H%M%S")
        filename = f"fuxa_fleet_snapshot_{ts_str}.tar.gz"
        archive_path = os.path.join(BACKUPS_DIR, filename)

        instances = port_engine.get_all_instances()
        manifest = {
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "filename": filename,
            "version": "1.0.0",
            "instances_count": len(instances),
            "instances": {k: {"name": v.get("name"), "port": v.get("port"), "plant": v.get("plant"), "tags": v.get("tag_count", 0)} for k, v in instances.items()}
        }

        def filter_tar(tarinfo):
            name = tarinfo.name.lower()
            if name.endswith(".log") or "node_modules" in name or "__pycache__" in name or ".git" in name:
                return None
            return tarinfo

        with tarfile.open(archive_path, "w:gz") as tar:
            if os.path.exists(INSTANCES_DIR):
                tar.add(INSTANCES_DIR, arcname="instances", filter=filter_tar)
            reg_file = os.path.join(BASE_DIR, "manager", "registry.json")
            if os.path.exists(reg_file):
                tar.add(reg_file, arcname="manager/registry.json")
            if os.path.exists(NGINX_CONF_DIR):
                tar.add(NGINX_CONF_DIR, arcname="nginx/conf.d", filter=filter_tar)

            manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
            tarinfo = tarfile.TarInfo(name="manifest.json")
            tarinfo.size = len(manifest_bytes)
            tarinfo.mtime = int(time.time())
            tar.addfile(tarinfo, io.BytesIO(manifest_bytes))

        size_kb = round(os.path.getsize(archive_path) / 1024, 2)
        record_watchdog_event("Backup Engine", f"Created disaster recovery snapshot {filename} ({size_kb} KB)", "BACKUP_CREATED")
        return {
            "success": True,
            "filename": filename,
            "size_kb": size_kb,
            "created_at": manifest["created_at"],
            "instances_count": len(instances),
            "manifest": manifest
        }
    except Exception as e:
        logger.error(f"Backup creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backup/list")
def api_list_backups():
    """Returns all available fleet snapshots sorted newest first"""
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    backups = []
    for f in glob.glob(os.path.join(BACKUPS_DIR, "*.tar.gz")):
        fname = os.path.basename(f)
        try:
            stat = os.stat(f)
            size_kb = round(stat.st_size / 1024, 2)
            c_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime))
            manifest = None
            try:
                with tarfile.open(f, "r:gz") as tar:
                    m_file = tar.extractfile("manifest.json")
                    if m_file:
                        manifest = json.loads(m_file.read().decode("utf-8"))
            except Exception:
                pass

            backups.append({
                "filename": fname,
                "size_kb": size_kb,
                "created_at": (manifest and manifest.get("created_at")) or c_time,
                "instances_count": (manifest and manifest.get("instances_count")) or 0,
                "manifest": manifest
            })
        except Exception:
            pass

    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return {"backups": backups}

@app.get("/api/backup/download/{filename}")
def api_download_backup(filename: str):
    safe_name = os.path.basename(filename)
    path = os.path.join(BACKUPS_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(path, filename=safe_name, media_type="application/gzip")

@app.post("/api/backup/upload")
async def api_upload_backup(file: UploadFile = File(...)):
    """Uploads an external .tar.gz snapshot into the backups repository"""
    if not file.filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Only .tar.gz backup files supported")
    safe_name = os.path.basename(file.filename)
    dest_path = os.path.join(BACKUPS_DIR, safe_name)
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)
    return {"success": True, "filename": safe_name, "size_kb": round(len(content) / 1024, 2)}

@app.post("/api/backup/restore")
def api_restore_backup(req: RestoreRequest):
    """Executes 1-click safe fleet recovery from snapshot"""
    safe_name = os.path.basename(req.filename)
    archive_path = os.path.join(BACKUPS_DIR, safe_name)
    if not os.path.exists(archive_path):
        raise HTTPException(status_code=404, detail="Backup file not found")

    logger.warning(f"[DISASTER-RECOVERY] Restoring fleet from {safe_name}...")
    was_enabled = watchdog_state["enabled"]
    watchdog_state["enabled"] = False

    try:
        # 1. Stop all current running view instances
        instances = port_engine.get_all_instances()
        for inst_id in list(instances.keys()):
            try:
                stop_instance(inst_id)
            except Exception:
                pass

        # 2. Extract snapshot
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(path=BASE_DIR)

        # 3. Reload registry & restart all instances
        port_engine.registry = port_engine._load_registry()
        ensure_default_storage_servers()

        restored_instances = port_engine.get_all_instances()
        restarted_count = 0
        for r_id, r_inst in list(restored_instances.items()):
            r_inst["user_stopped"] = False
            r_port = r_inst.get("port")
            if r_port and not port_engine.is_port_in_use(r_port):
                r_work_dir = r_inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{r_port}")
                r_subpath = r_inst.get("subpath") or f"/p{r_inst.get('plant', 9)}/div{r_inst.get('division', 1)}/l{r_inst.get('line', 1)}"
                pid = _launch_fuxa_instance(r_id, r_port, r_work_dir, r_subpath)
                r_inst["pid"] = pid
                r_inst["status"] = "RUNNING" if pid else "STOPPED"
                port_engine.register_instance(r_id, r_inst)
                restarted_count += 1

        reload_nginx()
        record_watchdog_event("Disaster Recovery", f"Fleet successfully restored from {safe_name} ({restarted_count} view servers recovered)", "RESTORE_SUCCESS")
        return {
            "success": True,
            "message": f"Successfully restored {restarted_count} view servers and all plant databases from snapshot!",
            "restarted_count": restarted_count
        }
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        watchdog_state["enabled"] = was_enabled

@app.delete("/api/backup/{filename}")
def api_delete_backup(filename: str):
    safe_name = os.path.basename(filename)
    path = os.path.join(BACKUPS_DIR, safe_name)
    if os.path.exists(path):
        os.remove(path)
        return {"success": True}
    raise HTTPException(status_code=404, detail="File not found")

# Static file serving for the Manager UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h3>FUXA Fleet Manager: index.html not found</h3>"

@app.get("/simulator", response_class=HTMLResponse)
@app.get("/softopc", response_class=HTMLResponse)
def serve_simulator():
    sim_file = os.path.join(static_dir, "simulator.html")
    if os.path.exists(sim_file):
        with open(sim_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h3>FUXA Soft OPC-UA Simulator: simulator.html not found</h3>"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=9000, reload=False)
