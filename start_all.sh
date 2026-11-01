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
    "$SCRIPT_DIR/venv/bin/pip" install --upgrade pip fastapi uvicorn asyncua psutil requests jinja2 aiofiles
else
    "$SCRIPT_DIR/venv/bin/pip" install -q aiofiles 2>/dev/null || true
fi

# Stop and disable system nginx if running on Port 80
if command -v systemctl &>/dev/null; then
    echo "Notice: Freeing Port 80 (stopping conflicting system nginx)..."
    sudo systemctl stop nginx 2>/dev/null || systemctl stop nginx 2>/dev/null || true
    sudo systemctl disable nginx 2>/dev/null || true
fi

# Ensure log files are writable or remove root-owned logs
for log_file in "$SCRIPT_DIR/opcua_bridge.log" "$SCRIPT_DIR/manager.log" "$SCRIPT_DIR/gateway.log"; do
    if [ -f "$log_file" ]; then
        if [ ! -w "$log_file" ]; then
            sudo rm -f "$log_file" 2>/dev/null || rm -f "$log_file" 2>/dev/null || true
        else
            > "$log_file" 2>/dev/null || true
        fi
    fi
done

# Force kill any lingering processes on critical ports 80, 9000, 4845
echo "Notice: Ensuring ports 80, 9000, 4845 are free..."
fuser -k 80/tcp 9000/tcp 4845/tcp 2>/dev/null || true
sudo fuser -k 80/tcp 9000/tcp 4845/tcp 2>/dev/null || true
pkill -9 -f "uvicorn" 2>/dev/null || true
pkill -9 -f "opcua_bridge.py" 2>/dev/null || true
pkill -9 -f "gateway.js" 2>/dev/null || true
sleep 1

if [ ! -d "$SCRIPT_DIR/fuxa/server/node_modules" ]; then
    echo "Installing FUXA server node modules..."
    cd "$SCRIPT_DIR/fuxa/server"
    npm install --omit=dev
    cd "$SCRIPT_DIR"
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
echo "💡 To view live terminal logs and alarms: ./logs.sh"
echo "💡 To filter only errors: ./logs.sh errors"
echo "=========================================================================="

if [ "$1" = "--live" ] || [ "$1" = "--logs" ] || [ "$1" = "-f" ]; then
    "$SCRIPT_DIR/logs.sh"
else
    trap "kill $BRIDGE_PID $MANAGER_PID $GATEWAY_PID 2>/dev/null || true; exit 0" INT TERM
    wait
fi
