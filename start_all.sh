#!/usr/bin/env bash
# ==============================================================================
# FUXA Fleet Manager & OPC-UA Central Bridge Launcher
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

VENV_PYTHON="$SCRIPT_DIR/venv/bin/python3"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Creating Python virtualenv..."
    python3 -m venv "$SCRIPT_DIR/venv"
    "$SCRIPT_DIR/venv/bin/pip" install --upgrade pip fastapi uvicorn asyncua psutil requests jinja2
fi

echo "=========================================================================="
echo " Starting FUXA Central Storage OPC-UA Bridge..."
echo " Endpoint: opc.tcp://0.0.0.0:4840/fuxa/server/"
echo "=========================================================================="
"$VENV_PYTHON" "$SCRIPT_DIR/bridge/opcua_bridge.py" > "$SCRIPT_DIR/opcua_bridge.log" 2>&1 &
BRIDGE_PID=$!
echo "OPC-UA Bridge started with PID $BRIDGE_PID"

echo "=========================================================================="
echo " Starting FUXA Fleet Manager Web Orchestrator..."
echo " Web UI: http://localhost:9000"
echo "=========================================================================="
cd "$SCRIPT_DIR/manager"
"$VENV_PYTHON" -m uvicorn server:app --host 0.0.0.0 --port 9000 > "$SCRIPT_DIR/manager.log" 2>&1 &
MANAGER_PID=$!
echo "Fleet Manager started with PID $MANAGER_PID"

echo ""
echo "=========================================================================="
echo " FUXA Fleet Management System is READY!"
echo " Open your browser: http://localhost:9000"
echo "=========================================================================="

trap "kill $BRIDGE_PID $MANAGER_PID 2>/dev/null || true; exit 0" INT TERM
wait
