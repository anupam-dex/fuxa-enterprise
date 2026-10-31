#!/usr/bin/env bash
# ==============================================================================
# FUXA Enterprise SCADA - Real-Time Terminal Log & Alarm Monitor
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

TARGET="${1:-all}"

echo "=========================================================================="
echo " 📡 FUXA Enterprise Real-Time Terminal Monitor"
echo " Target: $TARGET"
echo " Shows: System Errors [ERR], Warnings [WAR], Exceptions, SCADA Alarms"
echo " Press Ctrl+C to exit monitor"
echo "=========================================================================="

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

if [ "$TARGET" = "all" ]; then
    # Stream across all instances, manager, and gateway
    tail -n 30 -F instances/*/fuxa.log manager.log gateway.log opcua_bridge.log 2>/dev/null
elif [ "$TARGET" = "errors" ] || [ "$TARGET" = "alarms" ]; then
    echo -e "${YELLOW}Filtering only Errors, Warnings & Alarms...${NC}"
    tail -n 50 -F instances/*/fuxa.log instances/*/fuxa-err.log manager.log 2>/dev/null | grep --line-buffered -E "\[ERR\]|\[WAR\]|alarms|error|Error|Exception|failed|FAIL"
elif [[ "$TARGET" =~ ^[0-9]+$ ]]; then
    # Specific port
    LOG_FILE="instances/port_${TARGET}/fuxa.log"
    if [ -f "$LOG_FILE" ]; then
        tail -n 50 -F "$LOG_FILE"
    else
        echo "No log file found for port $TARGET at $LOG_FILE"
        echo "Available instances:"
        ls -d instances/port_* 2>/dev/null || echo "None created yet"
    fi
else
    echo "Usage: ./logs.sh [all | errors | alarms | <PORT>]"
    echo "Examples:"
    echo "  ./logs.sh              # Stream everything"
    echo "  ./logs.sh errors       # Stream only errors and warnings"
    echo "  ./logs.sh alarms       # Stream only alarms"
    echo "  ./logs.sh 9620         # Stream logs for port 9620"
fi
