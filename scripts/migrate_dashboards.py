#!/usr/bin/env python3
"""
==============================================================================
FUXA Enterprise SCADA - 1-Click Dashboard & View Migration Utility
==============================================================================
Migrates dashboards, HMI pages, SVG layouts, and widgets from an existing
production FUXA server or .fuxap / project.json export into a target
FUXA Enterprise View Server instance.

Automatically:
1. Extracts all views and layout definitions.
2. Analyzes widget tag bindings and auto-remaps tag IDs to the new Central Storage
   tags by matching tag names (zero manual remapping).
3. Injects views directly into the target View Server's SQLite database.
4. Generates navigation links in the top header.
5. Hot-reloads the View Server so dashboards are instantly accessible.
==============================================================================
"""

import sys
import os
import json
import sqlite3
import argparse
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
INSTANCES_DIR = os.path.join(BASE_DIR, "instances")
FLEET_MANAGER_URL = os.environ.get("FLEET_MANAGER_URL", "http://localhost:9000")


def load_source_project(source_path_or_url) -> dict:
    """Loads FUXA project JSON from a Python dict, remote URL, a .fuxap, or a .json file."""
    if isinstance(source_path_or_url, dict):
        return source_path_or_url
    if isinstance(source_path_or_url, (bytes, bytearray)):
        return json.loads(source_path_or_url.decode("utf-8"))
    if source_path_or_url.startswith("http://") or source_path_or_url.startswith("https://"):
        endpoint = source_path_or_url
        if not endpoint.endswith("/api/project"):
            endpoint = endpoint.rstrip("/") + "/api/project"
        print(f"[*] Fetching live project from {endpoint}...")
        req = urllib.request.Request(endpoint, headers={"User-Agent": "FUXA-Migrator/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data
    else:
        fpath = os.path.abspath(source_path_or_url)
        if not os.path.exists(fpath):
            raise FileNotFoundError(f"Source file not found: {fpath}")
        print(f"[*] Reading project export from {fpath}...")
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data


def get_target_db_path(target: str) -> tuple[str, str, int]:
    """
    Resolves the target SQLite DB path, instance ID, and port.
    target can be:
    - port number (e.g. 9610)
    - instance id (e.g. fuxa_p9_d6_l1_9610)
    - subpath (e.g. /p9/ps/ems)
    """
    reg_path = os.path.join(INSTANCES_DIR, "registry.json")
    instances = {}
    if os.path.exists(reg_path):
        try:
            with open(reg_path, "r") as f:
                reg = json.load(f)
                instances = reg.get("instances", {})
        except Exception:
            pass

    # Try matching by port or string
    matched_inst = None
    target_str = str(target).strip()
    
    for i_id, i_info in instances.items():
        if str(i_info.get("port")) == target_str:
            matched_inst = i_info
            break
        if i_id == target_str or i_info.get("name", "").lower() == target_str.lower():
            matched_inst = i_info
            break
        if i_info.get("subpath", "").rstrip("/") == target_str.rstrip("/"):
            matched_inst = i_info
            break

    if matched_inst:
        port = matched_inst["port"]
        inst_id = matched_inst["id"]
        work_dir = matched_inst.get("work_dir") or os.path.join(INSTANCES_DIR, f"port_{port}")
    else:
        # Fallback to port folder
        if target_str.isdigit():
            port = int(target_str)
            inst_id = f"port_{port}"
            work_dir = os.path.join(INSTANCES_DIR, f"port_{port}")
        else:
            raise ValueError(f"Could not identify View Server instance for '{target}'. Check Fleet Manager.")

    db_path = os.path.join(work_dir, "project.fuxap.db")
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Target View Server database not found at {db_path}")

    return db_path, inst_id, port


def load_target_tags(db_path: str) -> tuple[dict, dict]:
    """
    Loads all tags currently present in the target View Server database.
    Returns:
    - by_name: { normalized_name: { id, name, dev_name, dev_id } }
    - by_id:   { tag_id: { id, name, dev_name, dev_id } }
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name, value FROM devices;")
    rows = cur.fetchall()
    conn.close()

    by_name = {}
    by_id = {}

    for dev_id, dev_val in rows:
        try:
            dev_data = json.loads(dev_val)
            dev_name = dev_data.get("name", dev_id)
            tags = dev_data.get("tags", {})
            for t_id, t_info in tags.items():
                t_name = t_info.get("name", t_id)
                tag_entry = {
                    "id": t_id,
                    "name": t_name,
                    "dev_name": dev_name,
                    "dev_id": dev_id
                }
                by_id[t_id] = tag_entry
                norm_name = t_name.strip().lower().replace(" ", "_")
                by_name[norm_name] = tag_entry
        except Exception:
            pass

    return by_name, by_id


def remap_view_bindings(view_obj: dict, target_tags_by_name: dict, target_tags_by_id: dict) -> tuple[dict, dict]:
    """
    Inspects all widget items in the view and remaps their tag bindings
    to the target server's tags by tag name.
    """
    stats = {
        "total_items": 0,
        "bound_items": 0,
        "exact_matches": 0,
        "remapped": 0,
        "unmatched": []
    }

    items = view_obj.get("items", {})
    stats["total_items"] = len(items)

    for item_id, item in items.items():
        prop = item.get("property")
        if not prop or not isinstance(prop, dict):
            continue

        var_id = prop.get("variableId")
        var_name = prop.get("variable")

        if not var_id and not var_name:
            continue

        stats["bound_items"] += 1

        # Check if var_id is already an exact match in target
        if var_id and var_id in target_tags_by_id:
            stats["exact_matches"] += 1
            # Ensure device name is aligned
            prop["variableSrc"] = target_tags_by_id[var_id]["dev_name"]
            continue

        # Try to resolve by normalized tag name
        search_name = (var_name or var_id).strip().lower().replace(" ", "_")
        matched_target = target_tags_by_name.get(search_name)

        if matched_target:
            stats["remapped"] += 1
            prop["variableId"] = matched_target["id"]
            prop["variable"] = matched_target["name"]
            prop["variableSrc"] = matched_target["dev_name"]
        else:
            stats["unmatched"].append({
                "item_id": item_id,
                "item_type": item.get("type"),
                "variable": var_name or var_id
            })

    return view_obj, stats


def migrate(source: str, target: str, dry_run: bool = False, keep_existing: bool = True):
    print("=" * 70)
    print(" FUXA Enterprise SCADA - 1-Click Dashboard Migration")
    print("=" * 70)

    # 1. Load source project
    src_project = load_source_project(source)
    src_hmi = src_project.get("hmi", {})
    src_views = src_hmi.get("views", [])

    if not src_views and "views" in src_project:
        # Handle project where views is top-level
        src_views = src_project.get("views", [])

    if not src_views:
        print("[-] Error: No views found in the source project.")
        return False

    print(f"[+] Found {len(src_views)} view(s) in source project:")
    for v in src_views:
        v_name = v.get("name", "Unnamed")
        v_id = v.get("id", "Unknown")
        item_cnt = len(v.get("items", {}))
        print(f"    • [{v_id}] {v_name} ({item_cnt} widgets)")

    # 2. Resolve target DB & tags
    db_path, inst_id, port = get_target_db_path(target)
    print(f"[+] Target View Server: {inst_id} (Port {port})")
    print(f"[+] Target Database:    {db_path}")

    tags_by_name, tags_by_id = load_target_tags(db_path)
    print(f"[+] Loaded {len(tags_by_id)} target tag(s) across connected storage devices.")

    # 3. Remap all views
    remapped_views = []
    total_stats = {
        "views": len(src_views),
        "total_items": 0,
        "bound_items": 0,
        "exact_matches": 0,
        "remapped": 0,
        "unmatched": []
    }

    for v in src_views:
        rem_view, s = remap_view_bindings(v, tags_by_name, tags_by_id)
        remapped_views.append(rem_view)
        total_stats["total_items"] += s["total_items"]
        total_stats["bound_items"] += s["bound_items"]
        total_stats["exact_matches"] += s["exact_matches"]
        total_stats["remapped"] += s["remapped"]
        total_stats["unmatched"].extend(s["unmatched"])

    print("-" * 70)
    print(" Tag Binding Analysis:")
    print(f" • Total Widgets Analyzed:   {total_stats['total_items']}")
    print(f" • Bound Telemetry Widgets:  {total_stats['bound_items']}")
    print(f" • Exact Tag ID Matches:     {total_stats['exact_matches']}")
    print(f" • Auto-Remapped by Name:    {total_stats['remapped']}")
    print(f" • Unmatched Field Tags:     {len(total_stats['unmatched'])}")

    if total_stats["unmatched"]:
        print("   Notice - Unmatched tags in source widgets:")
        for u in total_stats["unmatched"][:10]:
            print(f"     - [{u['item_type']}] Variable: '{u['variable']}'")
        if len(total_stats["unmatched"]) > 10:
            print(f"     ... and {len(total_stats['unmatched']) - 10} more.")

    if dry_run:
        print("\n[!] Dry run mode active: No changes written to database.")
        return {
            "success": True,
            "views_count": len(remapped_views),
            "views": [{"id": v.get("id"), "name": v.get("name", "Unnamed"), "widgets": len(v.get("items", {}))} for v in remapped_views],
            "stats": total_stats,
            "target_instance": inst_id,
            "target_port": port,
            "dry_run": True,
            "message": f"[Dry Run] Successfully simulated migration of {len(remapped_views)} view(s) to Port {port}."
        }

    # 4. Write views and layout into target SQLite DB
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    if not keep_existing:
        print("[*] Clearing existing views in target database...")
        cur.execute("DELETE FROM views;")

    for v in remapped_views:
        v_id = v.get("id")
        cur.execute("INSERT OR REPLACE INTO views (name, value) VALUES (?, ?);", (v_id, json.dumps(v)))
        print(f"    ✓ Imported view: {v.get('name')} ({v_id})")

    # 5. Update layout navigation so all views have navigation buttons
    cur.execute("SELECT value FROM general WHERE name='layout';")
    row = cur.fetchone()
    layout = {}
    if row and row[0]:
        try:
            layout = json.loads(row[0])
        except Exception:
            pass

    if not layout:
        layout = {
            "start": remapped_views[0]["id"] if remapped_views else "view_overview",
            "navigation": {"mode": "over", "type": "inline", "items": []}
        }

    nav = layout.get("navigation", {})
    nav["mode"] = "over"
    existing_items = nav.get("items", [])
    existing_view_ids = {it.get("view") for it in existing_items if isinstance(it, dict)}

    colors = ["#1e293b", "#0f172a", "#1e1b4b", "#172554", "#064e3b"]
    for idx, v in enumerate(remapped_views):
        v_id = v.get("id")
        if v_id not in existing_view_ids:
            existing_items.append({
                "view": v_id,
                "text": v.get("name", f"Page {idx+1}"),
                "icon": "dashboard",
                "bkcolor": colors[idx % len(colors)],
                "fgcolor": "#ffffff"
            })
            existing_view_ids.add(v_id)

    nav["items"] = existing_items
    layout["navigation"] = nav
    if not layout.get("start") and remapped_views:
        layout["start"] = remapped_views[0]["id"]

    cur.execute("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ("layout", json.dumps(layout)))
    conn.commit()
    conn.close()

    print("[+] Database committed successfully.")

    # 6. Request View Server reload via Fleet Manager
    try:
        reload_url = f"{FLEET_MANAGER_URL.rstrip('/')}/api/instances/{inst_id}/sync-tags"
        req = urllib.request.Request(reload_url, data=b"", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"[+] Hot-reloaded View Server via Fleet Manager: {resp.read().decode('utf-8')[:80]}...")
    except Exception as e:
        print(f"[*] Note: Manual reload may be required if Fleet Manager is not listening at {FLEET_MANAGER_URL} ({e})")

    print("\n" + "=" * 70)
    print(f" ✓ MIGRATION COMPLETE! Migrated {len(remapped_views)} dashboard(s) to Port {port}!")
    print(f"   View live at: http://localhost:{port}/ or via Gateway subpath.")
    print("=" * 70)
    return {
        "success": True,
        "views_count": len(remapped_views),
        "views": [{"id": v.get("id"), "name": v.get("name", "Unnamed"), "widgets": len(v.get("items", {}))} for v in remapped_views],
        "stats": total_stats,
        "target_instance": inst_id,
        "target_port": port,
        "dry_run": False,
        "message": f"Successfully migrated {len(remapped_views)} dashboard(s) to {inst_id} (Port {port})"
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FUXA Enterprise SCADA Dashboard Migrator")
    parser.add_argument("--source", "-s", required=True, help="Path to .fuxap / .json file or old server URL (e.g. http://192.168.1.50:1881)")
    parser.add_argument("--target", "-t", default="9610", help="Target View Server port, instance ID, or subpath (default: 9610)")
    parser.add_argument("--dry-run", action="store_true", help="Preview tag matches and remappings without writing to DB")
    parser.add_argument("--replace", action="store_true", help="Replace existing views instead of appending")

    args = parser.parse_args()
    try:
        migrate(args.source, args.target, dry_run=args.dry_run, keep_existing=not args.replace)
    except Exception as ex:
        print(f"\n[-] Migration failed: {ex}")
        sys.exit(1)
