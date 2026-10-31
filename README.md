# FUXA Fleet Manager & OPC-UA Central Storage Bridge

An industrial-grade SCADA Orchestration platform built specifically to eliminate device duplication, export/import loops, and PLC connection overhead across multiple plants and divisions.

---

## Architecture Overview

```
                      FACTORY OT FLOOR (PLCs / S7 / Modbus)
                                       │
                                       ▼
                     [ 4 Plant Storage Servers (Ports 5100..5900) ]
                     - Always running
                     - Dedicated PLC polling & InfluxDB Logging
                                       │
                                       ▼ (Real-time Live Tags)
                     ┌───────────────────────────────────────────┐
                     │   Central OPC-UA Bridge (Port 4840/4845)  │
                     │   - Exposes hierarchical tag address tree │
                     │   - Plant -> Division -> Line -> Tag      │
                     └─────────────────────┬─────────────────────┘
                                           │ (opc.tcp://127.0.0.1:4840)
       ┌───────────────────────────────────┴───────────────────────────────────┐
       ▼                                                                       ▼
[ View Instance 9610 ]                                              [ View Instance 9620 ]
Plant 9 / Paintshop / Line 1                                        Plant 9 / Paintshop / Line 2
• Pre-loaded OPC-UA Device                                          • Pre-loaded OPC-UA Device
• Zero Direct PLCs                                                  • Zero Direct PLCs
• Native Tag Browsing in UI                                         • Native Tag Browsing in UI
• Subpath: /p9/div6/l1                                              • Subpath: /p9/div6/l2
```

---

## Key Features

1. **Deterministic Port Engine**:
   - Calculates port automatically from `Plant + Division + Line + 0` (e.g., Plant 9, Paintshop 6, Line 1 $\rightarrow$ `9610`).
   - Automatically detects occupied ports and resolves collisions (`9611`, `9612`...).
2. **Interactive Visual Port Matrix**:
   - Dashboard mapping all 4 plants, active storage ports, and deployed view servers.
   - 1-click links to launch the FUXA Editor (`/editor`) or Kiosk View (`/home`).
3. **Automated Zero-Driver Tag Ingestion**:
   - When an engineer creates a new project in the Fleet Manager, it pre-provisions `project.fuxap.db`.
   - **Only ONE device is configured**: `Plant_Storage_OPCUA`.
   - Modbus, S7, BACnet, and direct PLC drivers are hidden.
   - Historical InfluxDB logging is stripped so view instances never write to the database.
   - Clicking **"Browse Tags"** inside the FUXA UI displays the entire live plant hierarchy directly from the Storage Server.
4. **OT Security & Nginx Reverse Proxy**:
   - Automatic generation of isolated Nginx route files with long-lived WebSocket support (`proxy_read_timeout 86400s`).
   - Generates clean subpaths: `https://scada.plant.internal/p9/div6/l1`.

---

## Directory Structure

```text
fuxa-fleet-manager/
├── bridge/
│   └── opcua_bridge.py          # Central OPC-UA Server Bridge
├── manager/
│   ├── server.py                # FastAPI Orchestrator API
│   ├── port_engine.py           # Port calculation & collision resolver
│   ├── project_builder.py       # Pre-provisions clean SQLite project.fuxap.db
│   ├── registry.json            # Plant & Port allocation registry
│   └── static/                  # Dark-mode Web UI & Visual Port Map
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── nginx/
│   ├── fuxa_route_generator.py  # Nginx route generator
│   └── conf.d/                  # Auto-generated Nginx location blocks
├── fuxa/                        # Official FUXA (latest) repository
├── start_all.sh                 # 1-click launcher
└── test_system.py               # End-to-end integration test
```

---

## Quick Start on Linux

```bash
cd /opt/fuxa-fleet-manager
chmod +x start_all.sh
./start_all.sh
```

Open your browser at:
`http://<server-ip>:9000`
