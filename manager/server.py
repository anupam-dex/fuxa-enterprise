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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from port_engine import PortEngine
from project_builder import generate_fuxa_database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from nginx.fuxa_route_generator import generate_nginx_conf, reload_nginx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FleetManager")

app = FastAPI(title="FUXA Fleet Manager & Visual Port Orchestrator")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCES_DIR = os.path.join(BASE_DIR, "instances")
FUXA_SERVER_PATH = os.path.join(BASE_DIR, "fuxa", "server", "main.js")
NGINX_CONF_DIR = os.path.join(BASE_DIR, "nginx", "conf.d")

port_engine = PortEngine()
running_processes = {}  # instance_id -> subprocess.Popen

class CreateProjectRequest(BaseModel):
    plant: int
    division: int
    line: int
    project_name: str

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
    # 1. Calculate Port (Deterministic formula + Collision avoidance)
    port = port_engine.calculate_port(req.plant, req.division, req.line)
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
        opcua_endpoint="opc.tcp://127.0.0.1:4840"
    )

    # 3. Generate Nginx reverse proxy route & subpath
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
        "editor_url": f"{subpath}/editor",
        "home_url": f"{subpath}/home"
    }
    port_engine.register_instance(instance_id, instance_meta)

    return {
        "success": True,
        "instance": instance_meta,
        "message": f"View Server successfully created on Port {port} with pre-configured OPC-UA Storage tags!"
    }

def _launch_fuxa_instance(instance_id: str, port: int, work_dir: str, subpath: str):
    """Starts the FUXA instance process with BASE_PATH and userDir"""
    env = os.environ.copy()
    env["BASE_PATH"] = subpath
    env["NODE_OPTIONS"] = "--max-old-space-size=4096"

    # Try node on host
    node_cmd = "node"
    cmd = [node_cmd, FUXA_SERVER_PATH, "--port", str(port), "--userDir", work_dir]

    try:
        proc = subprocess.Popen(
            cmd,
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

# Static file serving for the Manager UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=9000, reload=False)
