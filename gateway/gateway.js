#!/usr/bin/env node
/**
 * FUXA Embedded OT Reverse Proxy Gateway
 * Replaces external Nginx completely.
 * Listens on Port 80 (or 443 with SSL) and dynamically routes clean subpaths
 * to internal FUXA view server ports (e.g. /p9/paintshop/line1 -> 127.0.0.1:9610).
 */

const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const fs = require('fs');
const path = require('path');

const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '80', 10);
const REGISTRY_PATH = path.resolve(__dirname, '../manager/registry.json');
const FLEET_MANAGER_PORT = parseInt(process.env.FLEET_MANAGER_PORT || '9000', 10);

let routingTable = {}; // subpath -> { port, plant, name }

function loadRoutes() {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
            const data = JSON.parse(raw);
            const instances = data.instances || {};
            const newTable = {};

            for (const [id, inst] of Object.entries(instances)) {
                if (inst.subpath && inst.port) {
                    const cleanPath = '/' + inst.subpath.replace(/^\/+|\/+$/g, '');
                    newTable[cleanPath] = {
                        port: inst.port,
                        name: inst.name || id,
                        plant: inst.plant
                    };
                }
            }
            routingTable = newTable;
        }
    } catch (e) {
        // preserve existing on read error
    }
}

// Initial load & watch
loadRoutes();
if (fs.existsSync(path.dirname(REGISTRY_PATH))) {
    fs.watchFile(REGISTRY_PATH, { interval: 1000 }, () => {
        loadRoutes();
        console.log(`[Gateway] Routing table updated: ${Object.keys(routingTable).length} active routes.`);
    });
}

function findTarget(reqUrl) {
    const parsed = url.parse(reqUrl);
    const pathname = parsed.pathname || '/';

    // Find longest matching prefix
    let bestMatch = null;
    let longestPrefix = '';

    for (const [subpath, target] of Object.entries(routingTable)) {
        if (pathname === subpath || pathname.startsWith(subpath + '/')) {
            if (subpath.length > longestPrefix.length) {
                longestPrefix = subpath;
                bestMatch = { ...target, prefix: subpath };
            }
        }
    }

    if (bestMatch) {
        return bestMatch;
    }

    // Only route root /, /static/, and manager /api/ to Fleet Manager
    if (pathname === '/' || pathname.startsWith('/static/') || pathname.startsWith('/api/')) {
        return { port: FLEET_MANAGER_PORT, prefix: '', name: 'FleetManager' };
    }

    return null;
}

// Create HTTP Gateway Server
const server = http.createServer((req, res) => {
    const target = findTarget(req.url);

    if (!target) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align:center; padding: 60px 20px; background: #0f172a; color: #f8fafc; min-height: 100vh; box-sizing: border-box;">
                <h1 style="color: #38bdf8; font-size: 2rem; margin-bottom: 10px;">FUXA View Server Not Found</h1>
                <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 25px;">The requested Line route <code style="background:#1e293b; color:#f1f5f9; padding: 4px 8px; border-radius: 4px;">${req.url}</code> has not been deployed yet or is currently stopped.</p>
                <a href="http://${req.headers.host ? req.headers.host.split(':')[0] : '127.0.0.1'}:9000" style="display: inline-block; background: #2563eb; color: white; padding: 10px 22px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open Fleet Manager to Launch Line</a>
            </div>
        `);
    }

    // Proxy HTTP request
    const options = {
        hostname: '127.0.0.1',
        port: target.port,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            'x-forwarded-for': req.socket.remoteAddress,
            'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
            'x-forwarded-host': req.headers['host'] || 'scada.plant.internal'
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`SCADA Gateway 502: Instance on port ${target.port} (${target.name}) is unreachable.`);
    });

    req.pipe(proxyReq, { end: true });
});

// Handle WebSocket / Socket.IO Upgrades
server.on('upgrade', (req, socket, head) => {
    const target = findTarget(req.url);

    if (!target) {
        socket.destroy();
        return;
    }

    // Connect to internal FUXA instance port via raw TCP socket
    const proxySocket = net.connect(target.port, '127.0.0.1', () => {
        // Replay initial HTTP upgrade handshake
        proxySocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
        for (const [key, val] of Object.entries(req.headers)) {
            proxySocket.write(`${key}: ${val}\r\n`);
        }
        proxySocket.write('\r\n');
        if (head && head.length) {
            proxySocket.write(head);
        }

        // Bi-directional pipe
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
    });

    proxySocket.on('error', () => {
        socket.destroy();
    });

    socket.on('error', () => {
        proxySocket.destroy();
    });
});

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log(` FUXA Embedded OT Gateway is LISTENING on Port ${GATEWAY_PORT}`);
    console.log(` Zero External Nginx Service Required!`);
    console.log(` Routes automatically managed from registry.`);
    console.log('================================================================');
});
