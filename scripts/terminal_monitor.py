#!/usr/bin/env python3
"""
FUXA Enterprise SCADA - Professional Terminal Log Colorizer & Streamer
Parses multi-source SCADA logs and formats errors, warnings, routes, and alarms
with high-visibility ANSI colors for professional industrial operations.
"""

import sys
import re

RED = "\033[1;31m"
YELLOW = "\033[1;33m"
GREEN = "\033[1;32m"
CYAN = "\033[0;36m"
MAGENTA = "\033[1;35m"
BLUE = "\033[1;34m"
GRAY = "\033[0;90m"
BOLD = "\033[1m"
RESET = "\033[0m"

current_source = "SYSTEM"
current_color = BLUE
errors_only = "--errors-only" in sys.argv

def format_line(line: str) -> str:
    # Highlight specific error tokens
    line = re.sub(r"\b(EADDRINUSE|SQLITE_MISUSE|ECONNREFUSED|ENOTFOUND)\b", f"{RED}{BOLD}\\1{RESET}", line)
    line = re.sub(r"\b(502 BAD GATEWAY|502 Bad Gateway)\b", f"{RED}{BOLD}\\1{RESET}", line)
    line = re.sub(r"\b(404 NOT FOUND|404 Not Found)\b", f"{YELLOW}{BOLD}\\1{RESET}", line)
    line = re.sub(r"\[ERR\]", f"{RED}{BOLD}[ERR]{RESET}", line)
    line = re.sub(r"\[WAR\]", f"{YELLOW}{BOLD}[WAR]{RESET}", line)
    line = re.sub(r"\[INF\]", f"{CYAN}[INF]{RESET}", line)
    return line

def process_stream():
    global current_source, current_color
    for raw_line in sys.stdin:
        line = raw_line.rstrip("\r\n")
        if not line:
            continue

        # Header check: ==> instances/port_9621/fuxa.log <==
        m = re.match(r"^==>\s*(.*?)\s*<==", line)
        if m:
            path = m.group(1)
            if "port_" in path:
                p_match = re.search(r"port_(\d+)", path)
                current_source = f"VIEW:{p_match.group(1)}" if p_match else "VIEW-SERVER"
                current_color = YELLOW
            elif "storage_" in path:
                s_match = re.search(r"storage_plant_\d+_(\d+)", path)
                current_source = f"STORAGE:{s_match.group(1)}" if s_match else "STORAGE"
                current_color = GREEN
            elif "manager" in path:
                current_source = "FLEET-MGR"
                current_color = BLUE
            elif "gateway" in path:
                current_source = "OT-GATEWAY"
                current_color = CYAN
            elif "opcua" in path:
                current_source = "OPCUA-BRIDGE"
                current_color = MAGENTA
            else:
                current_source = path.split("/")[-1]
                current_color = GRAY
            continue

        is_error = bool(re.search(
            r"\[ERR\]|\b(error|failed|exception|critical|fatal|502|EADDRINUSE|SQLITE_MISUSE|refused)\b",
            line,
            re.IGNORECASE
        ))
        is_warning = bool(re.search(
            r"\[WAR\]|\b(warn|warning|404|deprecated|missing)\b",
            line,
            re.IGNORECASE
        ))

        if errors_only and not (is_error or is_warning):
            continue

        formatted = format_line(line)
        tag = f"{current_color}[{current_source}]{RESET}"

        if is_error:
            print(f"{tag} {RED}{formatted}{RESET}", flush=True)
        elif is_warning:
            print(f"{tag} {YELLOW}{formatted}{RESET}", flush=True)
        else:
            print(f"{tag} {formatted}", flush=True)

if __name__ == "__main__":
    try:
        process_stream()
    except KeyboardInterrupt:
        pass
