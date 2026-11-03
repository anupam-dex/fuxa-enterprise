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
const PERSISTENT_REGISTRY = path.resolve(__dirname, '../instances/registry.json');
const FLEET_MANAGER_PORT = parseInt(process.env.FLEET_MANAGER_PORT || '9000', 10);
const CLIENT_DIST_DIR = path.resolve(__dirname, '../fuxa/client/dist');

let routingTable = {}; // subpath -> { port, plant, name }

function getTs() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function logInfo(msg) {
    console.log(`\x1b[36m[${getTs()}] [INF] [OT-GATEWAY]\x1b[0m ${msg}`);
}

function logWarn(msg) {
    console.warn(`\x1b[33;1m[${getTs()}] [WAR] [OT-GATEWAY]\x1b[0m ${msg}`);
}

function logError(msg, err) {
    const errMsg = err ? (err.message || String(err)) : '';
    console.error(`\x1b[31;1m[${getTs()}] [ERR] [OT-GATEWAY]\x1b[0m ${msg}${errMsg ? ' -> ' + errMsg : ''}`);
}

function loadRoutes() {
    try {
        const newTable = {};
        const filesToRead = [REGISTRY_PATH, PERSISTENT_REGISTRY];

        for (const fpath of filesToRead) {
            if (fs.existsSync(fpath)) {
                try {
                    const raw = fs.readFileSync(fpath, 'utf8');
                    const data = JSON.parse(raw);
                    const instances = data.instances || {};
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
                } catch (e) {}
            }
        }
        routingTable = newTable;
    } catch (e) {
        // preserve existing on read error
    }
}

// Initial load & watch
loadRoutes();
[REGISTRY_PATH, PERSISTENT_REGISTRY].forEach(p => {
    if (fs.existsSync(path.dirname(p))) {
        fs.watchFile(p, { interval: 1000 }, () => {
            loadRoutes();
            const routesList = Object.entries(routingTable).map(([sp, t]) => `${sp} -> :${t.port} (${t.name})`).join(', ');
            logInfo(`Routing table synced (${Object.keys(routingTable).length} active routes): ${routesList || 'none'}`);
        });
    }
});

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
    // Enable full CORS for all gateway operations & preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // 1. Dynamic Subpath Update API (called by FUXA UI to change custom URLs live)
    if (req.method === 'POST' && req.url === '/api/gateway/subpath') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const newSubpath = '/' + (data.subpath || '').replace(/^\/+|\/+$/g, '');
                const targetPort = parseInt(data.port, 10);

                if (!newSubpath || isNaN(targetPort)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid subpath or port' }));
                }

                // Update in-memory routing table immediately
                const portStr = String(targetPort);
                const pId = data.plant ? parseInt(data.plant, 10) : ((portStr.length >= 4) ? parseInt(portStr[0], 10) : 9);
                const dId = (portStr.length >= 4) ? parseInt(portStr[1], 10) : 6;
                const lId = (portStr.length >= 4) ? parseInt(portStr[2], 10) : 1;

                routingTable[newSubpath] = {
                    port: targetPort,
                    name: data.name || `Instance ${targetPort}`,
                    plant: pId
                };

                // Persist to both registry.json and protected instances/registry.json
                [REGISTRY_PATH, PERSISTENT_REGISTRY].forEach(p => {
                    try {
                        let reg = { plants: {}, divisions: {}, instances: {} };
                        if (fs.existsSync(p)) {
                            reg = JSON.parse(fs.readFileSync(p, 'utf8'));
                        }
                        reg.instances = reg.instances || {};
                        let found = false;
                        for (const [k, inst] of Object.entries(reg.instances)) {
                            if (inst.port === targetPort) {
                                inst.subpath = newSubpath;
                                inst.editor_url = `${newSubpath}/editor`;
                                inst.home_url = `${newSubpath}/home`;
                                if (data.name) inst.name = data.name;
                                if (!inst.plant) inst.plant = pId;
                                if (!inst.division) inst.division = dId;
                                if (!inst.line) inst.line = lId;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            const instKey = `fuxa_p${pId}_d${dId}_l${lId}_${targetPort}`;
                            reg.instances[instKey] = {
                                id: instKey,
                                port: targetPort,
                                plant: pId,
                                division: dId,
                                line: lId,
                                subpath: newSubpath,
                                name: data.name || `Custom Line (${newSubpath})`,
                                editor_url: `${newSubpath}/editor`,
                                home_url: `${newSubpath}/home`
                            };
                        }
                        if (!fs.existsSync(path.dirname(p))) {
                            fs.mkdirSync(path.dirname(p), { recursive: true });
                        }
                        fs.writeFileSync(p, JSON.stringify(reg, null, 2));
                    } catch (e) {}
                });

                // Notify Fleet Manager (Port 9000)
                try {
                    const notifyReq = http.request({
                        hostname: '127.0.0.1',
                        port: 9000,
                        path: '/api/update-subpath',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 1000
                    }, () => {});
                    notifyReq.on('error', () => {});
                    notifyReq.write(JSON.stringify({ subpath: newSubpath, port: targetPort, name: data.name }));
                    notifyReq.end();
                } catch (e) {}

                console.log(`[Gateway] Registered live subpath: ${newSubpath} -> Port ${targetPort}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, subpath: newSubpath, port: targetPort }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    const parsedReqUrl = url.parse(req.url);
    const pathname = parsedReqUrl.pathname || '/';

    // 2. Direct Assets Handler (serves editor tool icons, libraries & fonts requested at root /assets/...)
    if (pathname.startsWith('/assets/')) {
        const filePath = path.join(CLIENT_DIST_DIR, pathname);
        if (filePath.startsWith(CLIENT_DIST_DIR) && fs.existsSync(filePath)) {
            try {
                if (fs.statSync(filePath).isFile()) {
                    const ext = path.extname(filePath).toLowerCase();
                    const mimeTypes = {
                        '.svg': 'image/svg+xml',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.ico': 'image/x-icon',
                        '.js': 'application/javascript',
                        '.css': 'text/css',
                        '.json': 'application/json',
                        '.woff': 'font/woff',
                        '.woff2': 'font/woff2',
                        '.ttf': 'font/ttf'
                    };
                    res.writeHead(200, {
                        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
                        'Cache-Control': 'public, max-age=86400',
                        'Access-Control-Allow-Origin': '*'
                    });
                    return fs.createReadStream(filePath).pipe(res);
                }
            } catch (e) {}
        }
    }

    let target = findTarget(req.url);

    // Fallback: Infer target instance from Referer for un-prefixed requests (e.g. /_images/ or local assets)
    if (!target && req.headers['referer']) {
        try {
            const refUrl = new URL(req.headers['referer']);
            const refTarget = findTarget(refUrl.pathname);
            if (refTarget) {
                target = refTarget;
            }
        } catch (e) {}
    }

    if (!target) {
        logWarn(`404 NOT FOUND: "${req.method} ${req.url}" (Remote IP: ${req.socket.remoteAddress || '127.0.0.1'}) -> No view server route mapped in registry.`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align:center; padding: 60px 20px; background: #0f172a; color: #f8fafc; min-height: 100vh; box-sizing: border-box;">
                <h1 style="color: #38bdf8; font-size: 2rem; margin-bottom: 10px;">FUXA View Server Not Found</h1>
                <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 25px;">The requested Line route <code style="background:#1e293b; color:#f1f5f9; padding: 4px 8px; border-radius: 4px;">${req.url}</code> has not been deployed yet or is currently stopped.</p>
                <a href="http://${req.headers.host ? req.headers.host.split(':')[0] : '127.0.0.1'}:9000" style="display: inline-block; background: #2563eb; color: white; padding: 10px 22px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open Fleet Manager to Launch Line</a>
            </div>
        `);
    }

    // Rewrite path to target: strip subpath prefix so FUXA receives clean root paths
    let proxyPath = req.url;
    if (target.prefix && proxyPath.startsWith(target.prefix)) {
        proxyPath = proxyPath.slice(target.prefix.length);
        if (!proxyPath.startsWith('/')) {
            proxyPath = '/' + proxyPath;
        }
    }

    const options = {
        hostname: '127.0.0.1',
        port: target.port,
        path: proxyPath,
        method: req.method,
        headers: {
            ...req.headers,
            'x-forwarded-for': req.socket.remoteAddress,
            'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
            'x-forwarded-host': req.headers['host'] || '127.0.0.1',
            'x-subpath-prefix': target.prefix || ''
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        const isHtml = (proxyRes.headers['content-type'] || '').includes('text/html');
        const newHeaders = { ...proxyRes.headers };

        // Rewrite redirect Location header so subpath prefix is preserved
        if (target.prefix && newHeaders['location'] && newHeaders['location'].startsWith('/')) {
            if (!newHeaders['location'].startsWith(target.prefix)) {
                newHeaders['location'] = target.prefix + newHeaders['location'];
            }
        }

        if (isHtml && target.prefix) {
            // Buffer HTML and rewrite <base href> dynamically to current custom subpath
            const chunks = [];
            proxyRes.on('data', chunk => chunks.push(chunk));
            proxyRes.on('end', () => {
                let html = Buffer.concat(chunks).toString('utf8');
                const baseHref = target.prefix.replace(/\/+$/, '') + '/';

                // Rewrite <base href="...">
                html = html.replace(/<base href="[^"]*"\s*\/?>/i, `<base href="${baseHref}" />`);

                // Rewrite window.__BASE_PATH__
                html = html.replace(/window\.__BASE_PATH__\s*=\s*[^;]+/g, `window.__BASE_PATH__ = "${target.prefix}"`);

                const modifiedBuf = Buffer.from(html, 'utf8');
                newHeaders['content-length'] = modifiedBuf.length;
                delete newHeaders['etag']; // invalidate stale etag

                res.writeHead(proxyRes.statusCode, newHeaders);
                res.end(modifiedBuf);
            });
        } else {
            // Stream binary, assets, API responses directly
            res.writeHead(proxyRes.statusCode, newHeaders);
            proxyRes.pipe(res, { end: true });
        }
    });

    proxyReq.on('error', (err) => {
        logError(`502 BAD GATEWAY: Failed to forward "${req.method} ${req.url}" to "${target.name}" on Port ${target.port}`, err);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`SCADA Gateway 502: Instance on port ${target.port} (${target.name}) is unreachable.`);
    });

    req.pipe(proxyReq, { end: true });
});

// Handle WebSocket / Socket.IO Upgrades
server.on('upgrade', (req, socket, head) => {
    let target = findTarget(req.url);

    // Fallback: Infer target instance from Referer for un-prefixed WebSocket requests
    if (!target && req.headers['referer']) {
        try {
            const refUrl = new URL(req.headers['referer']);
            const refTarget = findTarget(refUrl.pathname);
            if (refTarget) {
                target = refTarget;
            }
        } catch (e) {}
    }

    if (!target) {
        logWarn(`WebSocket Upgrade Rejected: No target view server for "${req.url}" (Referer: ${req.headers['referer'] || 'none'})`);
        socket.destroy();
        return;
    }

    let proxyPath = req.url;
    if (target.prefix && proxyPath.startsWith(target.prefix)) {
        proxyPath = proxyPath.slice(target.prefix.length);
        if (!proxyPath.startsWith('/')) {
            proxyPath = '/' + proxyPath;
        }
    }

    // Connect to internal FUXA instance port via raw TCP socket
    const proxySocket = net.connect(target.port, '127.0.0.1', () => {
        // Replay initial HTTP upgrade handshake with rewritten path
        proxySocket.write(`${req.method} ${proxyPath} HTTP/${req.httpVersion}\r\n`);
        for (const [key, val] of Object.entries(req.headers)) {
            if (Array.isArray(val)) {
                for (const v of val) {
                    proxySocket.write(`${key}: ${v}\r\n`);
                }
            } else if (val !== undefined && val !== null) {
                proxySocket.write(`${key}: ${val}\r\n`);
            }
        }
        proxySocket.write('\r\n');
        if (head && head.length) {
            proxySocket.write(head);
        }

        // Bi-directional pipe
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
    });

    proxySocket.on('error', (err) => {
        logError(`WebSocket Connection Dropped: TCP disconnect to "${target.name}" on Port ${target.port}`, err);
        socket.destroy();
    });

    socket.on('error', () => {
        proxySocket.destroy();
    });

    proxySocket.on('close', () => {
        socket.destroy();
    });

    socket.on('close', () => {
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
