#!/usr/bin/env bash
# ==============================================================================
# FUXA Fleet Manager, Central OPC-UA Bridge & Embedded OT Gateway Launcher
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
echo " 1. Starting FUXA Central Storage OPC-UA Bridge..."
echo "    Endpoint: opc.tcp://0.0.0.0:4845/fuxa/server/"
echo "=========================================================================="
"$VENV_PYTHON" "$SCRIPT_DIR/bridge/opcua_bridge.py" > "$SCRIPT_DIR/opcua_bridge.log" 2>&1 &
BRIDGE_PID=$!
echo "OPC-UA Bridge started with PID $BRIDGE_PID"

echo "=========================================================================="
echo " 2. Starting FUXA Fleet Manager Web Orchestrator..."
echo "    Web UI: http://localhost:9000"
echo "=========================================================================="
cd "$SCRIPT_DIR/manager"
"$VENV_PYTHON" -m uvicorn server:app --host 0.0.0.0 --port 9000 > "$SCRIPT_DIR/manager.log" 2>&1 &
MANAGER_PID=$!
echo "Fleet Manager started with PID $MANAGER_PID"

# Check gateway port (default 80 on Linux/root, or 8080 for non-root)
GATEWAY_PORT="${GATEWAY_PORT:-80}"
if [ "$EUID" -ne 0 ] && [ "$GATEWAY_PORT" -lt 1024 ]; then
    GATEWAY_PORT=8080
    echo "Notice: Non-root user detected. Running Gateway on Port $GATEWAY_PORT (Use sudo for Port 80)."
fi

echo "=========================================================================="
echo " 3. Starting Embedded Node.js OT Gateway (Zero Nginx)..."
echo "    Gateway Port: $GATEWAY_PORT"
echo "=========================================================================="
GATEWAY_PORT="$GATEWAY_PORT" node "$SCRIPT_DIR/gateway/gateway.js" > "$SCRIPT_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
echo "Embedded Gateway started with PID $GATEWAY_PID"

echo ""
echo "=========================================================================="
echo " FUXA Enterprise SCADA Fleet is READY!"
echo " • Central Gateway: http://localhost:$GATEWAY_PORT"
echo " • Fleet Manager:   http://localhost:9000"
echo " • OPC-UA Bridge:   opc.tcp://localhost:4845/fuxa/server/"
echo "=========================================================================="

trap "kill $BRIDGE_PID $MANAGER_PID $GATEWAY_PID 2>/dev/null || true; exit 0" INT TERM
wait
