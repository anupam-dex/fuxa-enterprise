#!/usr/bin/env python3
"""
Nginx Route Generator for FUXA Fleet
Generates isolated reverse proxy location blocks with WebSockets and BASE_PATH support.
"""

import os
import subprocess

NGINX_TEMPLATE = """# Auto-generated route for {{ project_name }}
# Plant {{ plant }}, Division {{ division }}, Line {{ line }} -> Port {{ port }}

location {{ subpath }}/socket.io/ {
    proxy_pass http://127.0.0.1:{{ port }}/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}

location {{ subpath }}/ {
    proxy_pass http://127.0.0.1:{{ port }}/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
}
"""

def generate_nginx_conf(plant: int, division: int, line: int, port: int, project_name: str, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    subpath = f"/p{plant}/div{division}/l{line}"
    conf_content = NGINX_TEMPLATE \
        .replace("{{ plant }}", str(plant)) \
        .replace("{{ division }}", str(division)) \
        .replace("{{ line }}", str(line)) \
        .replace("{{ port }}", str(port)) \
        .replace("{{ project_name }}", project_name) \
        .replace("{{ subpath }}", subpath)

    filename = f"fuxa_p{plant}_d{division}_l{line}_{port}.conf"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "w") as f:
        f.write(conf_content)

    return filepath, subpath

def reload_nginx():
    """Attempts to test and reload system Nginx if running as root/sudo on Linux"""
    try:
        res = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
        if res.returncode == 0:
            subprocess.run(["nginx", "-s", "reload"], check=True)
            return True, "Nginx reloaded successfully"
        return False, f"Nginx test failed: {res.stderr}"
    except Exception as e:
        return False, str(e)
