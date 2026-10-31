# FUXA Enterprise SCADA Fleet & Zero-Nginx Gateway

A complete industrial SCADA orchestration suite built on top of the latest FUXA release.
Designed specifically for strict OT environments that disallow port numbers, require automatic tag mapping without manual dashboard redevelopment, and eliminate external Nginx configuration overhead.

---

## What Makes This Enterprise Version Different

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OT CLIENTS (OPERATORS / KIOSKS)                       │
│           Access via standard Port 80 / 443 (No custom ports!)             │
│      URL: https://scada.plant.internal/p9/paintshop/line1/home/Oven_1       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             EMBEDDED NODE.JS OT GATEWAY (Port 80 / 443)                    │
│   • Replaces external Nginx completely (Zero Nginx service required)        │
│   • Dynamic in-memory subpath routing: /p9/paintshop/line1 -> :9610         │
│   • Full WebSockets / Socket.IO streaming with zero 60-second timeouts     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Internal loopback: 127.0.0.1)
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌────────────────────────────────┐          ┌────────────────────────────────┐
│  View Server 9610 (Paintshop)  │          │  View Server 9620 (Assembly)   │
│  • StorageProxy Active         │          │  • StorageProxy Active         │
│  • Zero direct PLC polling     │          │  • Zero direct PLC polling     │
│  • Zero InfluxDB duplication   │          │  • Zero InfluxDB duplication   │
│  • 100% Exact Tag IDs matched  │          │  • 100% Exact Tag IDs matched  │
└────────────────┬───────────────┘          └────────────────┬───────────────┘
                 │                                           │
                 └─────────────────────┬─────────────────────┘
                                       │ (Internal socket/HTTP)
                                       ▼
                     ┌───────────────────────────────────┐
                     │ Plant Storage Server (Port 5100)  │
                     │ • Master PLC Connections          │
                     │ • Historical InfluxDB logging     │
                     └───────────────────────────────────┘
```

---

## Key Features Implemented

### 1. StorageProxy Driver (Zero-Remapping for Existing Dashboards)
* **Problem:** Re-adding devices breaks existing widget mappings and tag IDs across dozens of developed dashboards.
* **Solution:** When started with `STORAGE_SERVER_URL=http://127.0.0.1:5100`, FUXA loads your existing `project.json` directly. The `StorageProxy` driver maps all existing tag and device IDs (`d_xxxx`, `t_yyyy`) directly to the storage server stream.
* **Result:** **100% of existing dashboards, gauges, trends, and views work immediately without any editing or remapping.**

### 2. Embedded Node.js OT Gateway (Zero External Nginx)
* Located in `gateway/gateway.js`.
* Listens on **Port 80 / 443** (OT standard).
* Automatically reads the fleet routing table (`manager/registry.json`).
* Routes clean subpaths (e.g. `/plant9/paintshop/line1`) directly to internal ports (`9610`).
* Handles WebSocket upgrade handshakes transparently.

### 3. Custom URL & Public Host Box in Settings
* Inside **Settings $\rightarrow$ Server Settings**:
  * **Server Port:** Internal port (e.g., `9610`).
  * **Custom URL / Subpath:** Public path (e.g., `/plant9/paintshop/line1`).
  * **Public Domain / Host:** Domain name (e.g., `scada.plant.internal`).

### 4. 📋 "Copy Direct Page URL" for Every View
* **In View Properties Dialog:** A direct URL display with **[Copy URL]** and **[↗️ Open]** buttons.
* **In Views Sidebar List:** A quick **🔗 link icon** next to each view name that copies the exact OT-compliant link to the clipboard.

---

## Installation & Verification on Linux

### Step 1: Clone your repository
```bash
git clone git@github.com:anupam-dex/<your-new-repo>.git fuxa-enterprise
cd fuxa-enterprise
```

### Step 2: Install Node dependencies for FUXA Server
```bash
cd fuxa/server
npm install
cd ../..
```

### Step 3: Launch the Entire System (1-Click)
```bash
chmod +x start_all.sh
sudo ./start_all.sh
```
*(Running with `sudo` allows the Embedded Gateway to bind directly to standard **Port 80**).*

---

### Verifying Existing Project JSON

1. Open your browser at:
   `http://<server-ip>/p9/paintshop/line1/editor`
2. Go to **Settings $\rightarrow$ Project $\rightarrow$ Import Project**.
3. Upload your existing `project.json`.
4. Open your existing dashboards: **all tags, gauges, and historical charts will stream live immediately with zero manual mapping.**
