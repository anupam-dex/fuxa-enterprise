#!/usr/bin/env python3
"""
FUXA Fleet Manager - Orchestrator Web Server
Provides visual port map, wizard to create new instances, and life-cycle management.
"""

import os
import sys
import json
import psutil
import subprocess
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

from port_engine import PortEngine
from project_builder import generate_fuxa_database, sync_tags_to_view_database, get_storage_tags_for_plant, update_project_name_in_db
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

port_engine = PortEngine()
running_processes = {}  # instance_id -> subprocess.Popen

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
def on_startup():
    logger.info("Initializing FUXA Fleet Orchestrator...")
    # 1. Host storage servers for all plants by default
    ensure_default_storage_servers()

    # 2. Automatically restore, sync tags and re-launch all existing view servers
    instances = port_engine.get_all_instances()
    for inst_id, inst in list(instances.items()):
        port = inst.get("port")
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

        if port and not port_engine.is_port_in_use(port):
            logger.info(f"Auto-restoring View Server {inst_id} on Port {port} ({subpath})...")
            pid = _launch_fuxa_instance(inst_id, port, work_dir, subpath)
            inst["pid"] = pid
            inst["status"] = "RUNNING" if pid else "STOPPED"
            port_engine.register_instance(inst_id, inst)

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

@app.post("/api/update-subpath")
def update_subpath(req: UpdateSubpathRequest):
    new_sub = "/" + req.subpath.strip("/")
    instances = port_engine.get_all_instances()
    found = False
    target_work_dir = None
    for inst_id, inst in instances.items():
        if inst.get("port") == req.port:
            inst["subpath"] = new_sub
            inst["editor_url"] = f"{new_sub}/editor"
            inst["home_url"] = f"{new_sub}/home"
            if req.name:
                inst["name"] = req.name
            target_work_dir = inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{req.port}")
            port_engine.register_instance(inst_id, inst)
            found = True
            break

    if not found:
        inst_id = f"port_{req.port}"
        target_work_dir = os.path.join(INSTANCES_DIR, f"port_{req.port}")
        inst = {
            "id": inst_id,
            "port": req.port,
            "subpath": new_sub,
            "name": req.name or f"Custom Line ({new_sub})",
            "work_dir": target_work_dir,
            "editor_url": f"{new_sub}/editor",
            "home_url": f"{new_sub}/home"
        }
        port_engine.register_instance(inst_id, inst)
        found = True

    # Persist project name directly inside FUXA SQLite DB
    if req.name and target_work_dir:
        db_path = os.path.join(target_work_dir, "project.fuxap.db")
        update_project_name_in_db(db_path, req.name)
        # Notify FUXA instance process if running
        try:
            import requests
            requests.post(f"http://127.0.0.1:{req.port}/api/project-name", credentials=None, json={"name": req.name}, timeout=0.3)
        except Exception:
            pass

    # Notify Embedded Gateway on Port 80
    try:
        import requests
        requests.post("http://127.0.0.1:80/api/gateway/subpath", json={"subpath": new_sub, "port": req.port, "name": req.name}, timeout=0.5)
    except Exception:
        pass

    return {"success": True, "subpath": new_sub, "found": found}

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
        "divisions": port_engine.registry.get("divisions", {})
    }

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
    # Normalize work_dir to local machine
    if not os.path.exists(work_dir):
        work_dir = os.path.join(INSTANCES_DIR, f"port_{port}")
    os.makedirs(work_dir, exist_ok=True)

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
    inst["pid"] = None
    port_engine.register_instance(instance_id, inst)
    return {"success": True, "status": "STOPPED"}

@app.post("/api/instances/{instance_id}/start")
def start_instance(instance_id: str):
    instances = port_engine.get_all_instances()
    if instance_id not in instances:
        raise HTTPException(status_code=404, detail="Instance not found")

    inst = instances[instance_id]
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=9000, reload=False)
