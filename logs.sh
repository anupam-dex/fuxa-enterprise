#!/usr/bin/env bash
# ==============================================================================
# FUXA Enterprise SCADA - Professional Real-Time Terminal Log & Alarm Monitor
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

PYTHON_BIN="$SCRIPT_DIR/venv/bin/python3"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

COLORIZER="$SCRIPT_DIR/scripts/terminal_monitor.py"
TARGET="${1:-all}"

# Ensure base log files exist
touch "$SCRIPT_DIR/gateway.log" "$SCRIPT_DIR/manager.log" "$SCRIPT_DIR/opcua_bridge.log" 2>/dev/null || true

# Header
echo -e "\033[1;34m==========================================================================\033[0m"
echo -e "\033[1;36m 📡 FUXA Enterprise SCADA - Professional Terminal Monitor\033[0m"
echo -e " Mode: \033[1;33m$TARGET\033[0m"
echo -e " Tracking: Gateway (:80), Fleet Manager (:9000), OPC-UA (:4845), View Servers"
echo -e " Press \033[1;31mCtrl+C\033[0m to exit monitor"
echo -e "\033[1;34m==========================================================================\033[0m"

# Collect all available log files dynamically
FILES=("$SCRIPT_DIR/gateway.log" "$SCRIPT_DIR/manager.log" "$SCRIPT_DIR/opcua_bridge.log")
for f in "$SCRIPT_DIR"/instances/*/fuxa.log; do
    if [ -f "$f" ]; then
        FILES+=("$f")
    fi
done

if [ "$TARGET" = "all" ]; then
    tail -n 25 -F "${FILES[@]}" 2>/dev/null | "$PYTHON_BIN" "$COLORIZER"
elif [ "$TARGET" = "errors" ] || [ "$TARGET" = "alarms" ]; then
    echo -e "\033[1;33m[!] Filtering only System Errors, 404/502 Routing Faults & Critical Alarms...\033[0m\n"
    tail -n 50 -F "${FILES[@]}" 2>/dev/null | "$PYTHON_BIN" "$COLORIZER" --errors-only
elif [ "$TARGET" = "gateway" ]; then
    tail -n 50 -F "$SCRIPT_DIR/gateway.log" 2>/dev/null | "$PYTHON_BIN" "$COLORIZER"
elif [ "$TARGET" = "manager" ]; then
    tail -n 50 -F "$SCRIPT_DIR/manager.log" 2>/dev/null | "$PYTHON_BIN" "$COLORIZER"
elif [[ "$TARGET" =~ ^[0-9]+$ ]]; then
    PORT_LOG="$SCRIPT_DIR/instances/port_${TARGET}/fuxa.log"
    if [ -f "$PORT_LOG" ]; then
        echo -e "\033[1;33mStreaming View Server on Port $TARGET...\033[0m"
        tail -n 50 -F "$PORT_LOG" 2>/dev/null | "$PYTHON_BIN" "$COLORIZER"
    else
        echo -e "\033[1;31m[ERR] No log file found for Port $TARGET at $PORT_LOG\033[0m"
        echo "Active instances:"
        ls -d "$SCRIPT_DIR"/instances/port_* 2>/dev/null || echo "None found"
    fi
else
    echo "Usage: ./logs.sh [all | errors | gateway | manager | <PORT>]"
    echo "Examples:"
    echo "  ./logs.sh              # Live stream all components"
    echo "  ./logs.sh errors       # Stream only errors, 502/404, and warnings"
    echo "  ./logs.sh gateway      # Stream only Port 80 OT Gateway routing"
    echo "  ./logs.sh 9621         # Stream View Server Port 9621 (EMS)"
fi
