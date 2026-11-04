
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const nopt = require("nopt");
const schedule = require('node-schedule');
const jwt = require('jsonwebtoken');

const paths = require('./paths');
const logger = require('./runtime/logger');
const utils = require('./runtime/utils');
var events = require("./runtime/events").create();
const FUXA = require('./fuxa.js');
const runtime = require('./runtime');
const authJwt = require('./api/jwt-helper');

let BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const express = require('express');
const app = express();

var server;
var settingsFile;

var startTime = new Date();

var knownOpts = {
    "help": Boolean,
    "port": Number,
    "userDir": [path]
};
var shortHands = {
    "?": ["--help"],
    "p": ["--port"],
    "u": ["--userDir"]
};

nopt.invalidHandler = function (k, v, t) {
    // TODO: console.log(k,v,t);
}

var parsedArgs = nopt(knownOpts, shortHands, process.argv, 2);

if (parsedArgs.help) {
    console.log("FUXA v" + FUXA.version());
    console.log("Usage: fuxa [-?] [--port PORT] [--userDir DIR]");
    console.log("");
    console.log("Options:");
    console.log("  -p, --port     PORT  port to listen on");
    console.log("  -u, --userDir  DIR   use specified user directory");
    console.log("  -?, --help           show this help");
    process.exit();
}

// Define directory
var rootDir = __dirname;
var workDir = path.resolve(process.cwd(), '_appdata');

if (process.env.userDir) {
    rootDir = process.env.userDir;
    workDir = path.resolve(process.env.userDir, '_appdata');
}

if (parsedArgs.userDir) {
    rootDir = parsedArgs.userDir;
    workDir = path.resolve(parsedArgs.userDir, '_appdata');
}

if (parsedArgs.env) {
    require('./envParams.js');
}

if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir);
}

// Read app settings
var appSettingsFile = path.join(workDir, 'settings.js');
if (fs.existsSync(appSettingsFile)) {
    // _appdata/settings.js exists
    settingsFile = appSettingsFile;
} else {
    // Not exist, copy from code resource
    var defaultSettings = path.join(__dirname, 'settings.default.js');
    try {
        fs.copyFileSync(defaultSettings, appSettingsFile, fs.constants.COPYFILE_EXCL);
        logger.debug('settings.js default created successful!');
    } catch (err) {
        logger.error(err);
    }
    settingsFile = appSettingsFile;
}
try {
    // load settings and set some app variable
    var settings = require(settingsFile);
    // check new settings from default and merge if not defined
    var defSettings = require(path.join(__dirname, 'settings.default.js'));
    if (defSettings.version !== settings.version) {
        logger.warn("Settings are outdated. Missing fields have been merged from defaults. Consider reviewing 'settings.json'.");
        settings = utils.deepMerge(defSettings, settings);
    }

    settings.workDir = workDir;
    settings.appDir = __dirname;
    settings.packageDir = path.resolve(rootDir, '_pkg');
    settings.settingsFile = settingsFile;
    settings.environment = process.env.NODE_ENV || 'prod';
    settings.uploadFileDir = '_upload_files';
    settings.imagesFileDir = path.resolve(rootDir, '_images');
    settings.widgetsFileDir = path.resolve(rootDir, '_widgets');
    settings.reportsDir = path.resolve(rootDir, '_reports');
    settings.webcamSnapShotsDir = path.resolve(rootDir, settings.webcamSnapShotsDir);
    settings.logDir = path.resolve(rootDir, settings.logDir);
    settings.dbDir = path.resolve(rootDir, settings.dbDir || '_db');
    if (!BASE_PATH && settings.basePath) {
        BASE_PATH = settings.basePath.replace(/\/+$/, '');
    }
} catch (err) {
    logger.error('Error loading settings file: ' + settingsFile)
    if (err.code == 'MODULE_NOT_FOUND') {
        if (err.toString().indexOf(settingsFile) === -1) {
            logger.error(err.toString());
        }
    } else {
        logger.error(err);
    }
    process.exit();
}
// Read user settings
try {
    var userSettingsFile = path.join(workDir, 'mysettings.json');
    settings.userSettingsFile = userSettingsFile;
    if (fs.existsSync(userSettingsFile)) {
        var mysettings = JSON.parse(fs.readFileSync(userSettingsFile, 'utf8'));
        if (mysettings.language) {
            settings.language = mysettings.language;
        }
        if (!utils.isNullOrUndefined(mysettings.hideEditorOnboarding)) {
            settings.hideEditorOnboarding = mysettings.hideEditorOnboarding;
        }
        if (mysettings.editorSectionMessages) {
            settings.editorSectionMessages = Object.assign(
                {},
                settings.editorSectionMessages || {},
                mysettings.editorSectionMessages
            );
        }
        if (mysettings.uiPort) {
            settings.uiPort = mysettings.uiPort;
        }
        if (!utils.isNullOrUndefined(mysettings.secureEnabled)) {
            settings.secureEnabled = mysettings.secureEnabled;
            if (!settings.tokenExpiresIn) {
                settings.tokenExpiresIn = '1h';
            }
        }
        if (!utils.isNullOrUndefined(mysettings.secureOnlyEditor)) {
            settings.secureOnlyEditor = mysettings.secureOnlyEditor;
        }
        if (mysettings.tokenExpiresIn) {
            settings.tokenExpiresIn = mysettings.tokenExpiresIn;
        }
        if (!utils.isNullOrUndefined(mysettings.enableRefreshCookieAuth)) {
            settings.enableRefreshCookieAuth = mysettings.enableRefreshCookieAuth;
        }
        if (mysettings.refreshTokenExpiresIn) {
            settings.refreshTokenExpiresIn = mysettings.refreshTokenExpiresIn;
        }
        if (mysettings.secretCode) {
            settings.secretCode = mysettings.secretCode;
        }
        if (mysettings.smtp) {
            settings.smtp = mysettings.smtp;
        }
        if (mysettings.daqstore) {
            settings.daqstore = mysettings.daqstore;
        }
        if (mysettings.alarms) {
            settings.alarms = mysettings.alarms;
        }
        if (mysettings.logs) {
            settings.logs = mysettings.logs;
        }
        if (!utils.isNullOrUndefined(mysettings.broadcastAll)) {
            settings.broadcastAll = mysettings.broadcastAll;
        }
        if (!utils.isNullOrUndefined(mysettings.lazyViewLoading)) {
            settings.lazyViewLoading = mysettings.lazyViewLoading;
        }
        if (!utils.isNullOrUndefined(mysettings.logFull)) {
            settings.logFull = mysettings.logFull;
        }
        if (!utils.isNullOrUndefined(mysettings.userRole)) {
            settings.userRole = mysettings.userRole;
        }
        if (!utils.isNullOrUndefined(mysettings.nodeRedEnabled)) {
            settings.nodeRedEnabled = mysettings.nodeRedEnabled;
        }
        if (!utils.isNullOrUndefined(mysettings.nodeRedAuthMode)) {
            settings.nodeRedAuthMode = mysettings.nodeRedAuthMode;
        }
        if (!utils.isNullOrUndefined(mysettings.swaggerEnabled)) {
            settings.swaggerEnabled = mysettings.swaggerEnabled;
        }
        if (mysettings.nodeRedEnabled === true && utils.isNullOrUndefined(mysettings.nodeRedAuthMode)) {
            settings.nodeRedAuthMode = 'legacy-open';
        }
    }
} catch (err) {
    logger.error('Error loading user settings file: ' + userSettingsFile)
}

// Ensure secure mode never runs with an empty/static-known JWT secret.
if (settings.secureEnabled && !settings.secretCode) {
    settings.secretCode = utils.generateSecretCode();
    logger.warn('Generated a random JWT secret in memory because secureEnabled=true and secretCode was missing. Persist it in settings for stable sessions across restarts.');
}

// Check logger
if (!settings.logDir) {
    settings.logDir = path.resolve(rootDir, '_logs');
}
if (!fs.existsSync(settings.logDir)) {
    fs.mkdirSync(settings.logDir);
}

logger.init(settings);
const version = FUXA.version();
if (version.indexOf('beta') > 0) {
    logger.warn('FUXA V.' + version);
} else {
    logger.info('FUXA V.' + version);
}

// Check storage Database dir
if (!fs.existsSync(settings.dbDir)) {
    fs.mkdirSync(settings.dbDir);
}
// Check package folder
if (!fs.existsSync(settings.packageDir)) {
    fs.mkdirSync(settings.packageDir);
}
// Check reports folder
if (!fs.existsSync(settings.reportsDir)) {
    fs.mkdirSync(settings.reportsDir);
}
// Check upload file folder
settings.httpUploadFileStatic = 'resources';
settings.uploadFileDir = path.resolve(workDir, settings.uploadFileDir);
if (!fs.existsSync(settings.uploadFileDir)) {
    fs.mkdirSync(settings.uploadFileDir);
}
// Check images resources folder
if (!fs.existsSync(settings.imagesFileDir)) {
    fs.mkdirSync(settings.imagesFileDir);
}
// Check widgets resources folder
if (!fs.existsSync(settings.widgetsFileDir)) {
    fs.mkdirSync(settings.widgetsFileDir);
}
// Check webcam shots  folder
if (!fs.existsSync(settings.webcamSnapShotsDir)) {
    fs.mkdirSync(settings.webcamSnapShotsDir);
}

// Server settings
if (settings.https) {
    server = https.createServer(settings.https, app);
} else {
    server = http.createServer(app);
}
server.setMaxListeners(0);

const ioSocketPath = '/socket.io';

// Normalize incoming Socket.IO requests & WebSocket upgrades to match standard '/socket.io',
// ensuring reverse proxies (OT Gateway, Nginx) connect seamlessly whether they rewrite/strip subpaths or not.
const normalizeSocketIoUrl = (req) => {
    if (!req || !req.url) return;
    const socketIoIndex = req.url.indexOf('/socket.io');
    if (socketIoIndex !== -1) {
        const queryAndRest = req.url.slice(socketIoIndex + '/socket.io'.length);
        req.url = '/socket.io' + queryAndRest;
    }
};

const io = socketIO(server, {
    pingInterval: 60000,    // send ping interval
    pingTimeout: 120000,    // close connection if pong is not received
    allowEIO3: true,        // Whether to enable compatibility with Socket.IO v2 clients.
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    },
    path: ioSocketPath,
});

// CRITICAL FIX FOR AUTOMATIC FLICKERING / REFRESHING:
// Express automatically returns 404 for unrouted requests.
// We intercept '/socket.io' and pass it directly to Socket.IO engine before Express can 404 it!
server.removeAllListeners('request');
server.on('request', (req, res) => {
    normalizeSocketIoUrl(req);
    if (req.url && (req.url === '/socket.io' || req.url.startsWith('/socket.io/') || req.url.startsWith('/socket.io?'))) {
        if (io.engine && typeof io.engine.handleRequest === 'function') {
            return io.engine.handleRequest(req, res);
        }
    }
    app(req, res);
});

server.removeAllListeners('upgrade');
server.on('upgrade', (req, socket, head) => {
    normalizeSocketIoUrl(req);
    if (req.url && (req.url === '/socket.io' || req.url.startsWith('/socket.io/') || req.url.startsWith('/socket.io?'))) {
        if (io.engine && typeof io.engine.handleUpgrade === 'function') {
            return io.engine.handleUpgrade(req, socket, head);
        }
    }
});

// Check settings value
var www = path.resolve(__dirname, '../client/dist');
if (!fs.existsSync(www)) {      // compatibility with docker/npm/electron
    www = path.resolve(__dirname, './dist');
}

settings.httpStatic = settings.httpStatic || www;

// In-memory BASE_PATH, rewrites the in-memory copy to work with read-only deployments
let indexHtmlCache = null;
const rewrittenAssets = new Map(); // request path -> { content, type }

if (BASE_PATH) {
    // here, if a BASE_PATH is set, I push it in the base html, at runtime
    try {
        const indexHtmlPath = path.join(settings.httpStatic, 'index.html');
        const desiredBase = (BASE_PATH || '') + '/';
        const withBase = fs.readFileSync(indexHtmlPath, 'utf8')
            .replace(/<base href="[^"]*"\s*\/?>/, `<base href="${desiredBase}" />`);
        // hook for any runtime code that wants BASE_PATH without parsing <base>
        const bootstrap = `<script>window.__BASE_PATH__=${JSON.stringify(BASE_PATH)};</script>`;
        indexHtmlCache = withBase.replace('</head>', `${bootstrap}</head>`);
    } catch (err) {
        logger.warn('Could not prepare <base href> from BASE_PATH, if working under a reverse proxy check your BASE_PATH env var: ' + err);
    }
    // and edit the references in .css/.js files, in memory only
    const collectAssets = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { collectAssets(full); }
            else if (/\.(js|css)$/.test(e.name)) {
                const src = fs.readFileSync(full, 'utf8');
                const out = src.replace(/(["'(])\/assets\//g, `$1${BASE_PATH}/assets/`);
                if (out !== src) {
                    const reqPath = BASE_PATH + '/' + path.relative(settings.httpStatic, full).split(path.sep).join('/');
                    rewrittenAssets.set(reqPath, { content: out, type: e.name.endsWith('.css') ? 'text/css' : 'application/javascript' });
                }
            }
        }
    };
    try { collectAssets(settings.httpStatic); }
    catch (err) { logger.warn('asset base-path rewrite (in-memory) failed: ' + err); }
    // the favicon is handled directly in the index.html that angular uses
}

if (parsedArgs.port !== undefined) {
    settings.uiPort = parsedArgs.port;
} else {
    if (settings.uiPort === undefined) {
        settings.uiPort = 1881;
    }
}
settings.uiHost = settings.uiHost || "0.0.0.0";

// Wait ending initialization
events.once('init-runtime-ok', function () {
    logger.info('FUXA init in  ' + utils.endTime(startTime) + 'ms.');
    startFuxa();
    initWebcamSnapshotCleanup();
});

// Init FUXA
try {
    FUXA.init(server, io, settings, logger, events);
} catch (err) {
    if (err.code == 'unsupported_version') {
        logger.error('Unsupported version of node.js:', process.version);
        logger.error('FUXA requires node.js v6 or later');
    } else if (err.code == 'not_built') {
        logger.error('FUXA has not been built. See README.md for details');
    } else {
        logger.error('Failed to start server:');
        if (err.stack) {
            logger.error(err.stack);
        } else {
            logger.error(err);
        }
    }
    process.exit(1);
}

// Http Server for client UI
const allowCrossDomain = function (req, res, next) {
    const origin = req.headers.origin;
    const allowedOrigins = settings.allowedOrigins || ["*"];

    const isOriginAllowed = (origin) => {
        if (!origin) return false;
        if (allowedOrigins.includes("*")) return true;

        // Convert wildcard-style strings to regex
        return allowedOrigins.some(pattern => {
            if (!pattern.includes("*")) return pattern === origin;

            // Escape dots and replace * with regex
            const regexPattern = new RegExp(
                "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
            );
            return regexPattern.test(origin);
        });
    };

    if (isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');

        if (settings.enableRefreshCookieAuth || settings.nodeRedEnabled) {
            res.header('Access-Control-Allow-Credentials', 'true');
        }
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'x-access-token, x-auth-user, Origin, Content-Type, Accept, Skip-Auth, Skip-Error');


    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
};

function getCookieValue(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return null;
    }
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [key, ...rest] = cookie.trim().split('=');
        if (key === name) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return null;
}

function snapshotAuth(req, res, next) {
    if (!settings.secureEnabled) {
        return next();
    }

    const token = req.query?.token || req.headers['x-access-token'] || getCookieValue(req, 'fuxa_access');
    if (!token || token === 'null') {
        return res.status(401).end();
    }

    try {
        const decoded = jwt.verify(token, authJwt.secretCode);
        if (!decoded?.id || authJwt.isGuestUser(decoded.id, decoded.groups)) {
            return res.status(401).end();
        }
        res.header('Cache-Control', 'no-store');
        return next();
    } catch {
        return res.status(401).end();
    }
}

// All the calls that are directly parsed as static http are mapped here
const SHELL_ROUTES = [
    '/',
    '/home',
    '/home/:viewName',
    '/lab',
    '/editor',
    '/device',
    '/plugins',
    '/rodevice',
    '/users',
    '/view',
    '/ar'
];

app.use(allowCrossDomain);

if (indexHtmlCache) {
    const serveShell = (req, res) => res.type('html').send(indexHtmlCache);
    for (const shellPath of SHELL_ROUTES) {
        if (BASE_PATH) {
            app.get(BASE_PATH + shellPath, serveShell);
        }
        app.get(shellPath, serveShell);
    }
}
if (rewrittenAssets.size) {
    app.use((req, res, next) => {
        const rewritten = rewrittenAssets.get(req.path);
        rewritten ? res.type(rewritten.type).send(rewritten.content) : next();
    });
}

for (const shellPath of SHELL_ROUTES) {
    if (BASE_PATH) {
        app.use(BASE_PATH + shellPath, express.static(settings.httpStatic));
    }
    app.use(shellPath, express.static(settings.httpStatic));
}
// while paths that have to serve non-angular paths are here
const defaultImagesDir = path.resolve(__dirname, '_images');
if (BASE_PATH) {
    app.use(BASE_PATH + '/' + settings.httpUploadFileStatic, express.static(settings.uploadFileDir));
    app.use(BASE_PATH + '/_images', express.static(settings.imagesFileDir));
    app.use(BASE_PATH + '/_images', express.static(defaultImagesDir));
    app.use(BASE_PATH + '/_widgets', express.static(settings.widgetsFileDir));
    app.use(BASE_PATH + '/snapshots', snapshotAuth, express.static(settings.webcamSnapShotsDir));
}
app.use('/' + settings.httpUploadFileStatic, express.static(settings.uploadFileDir));
app.use('/_images', express.static(settings.imagesFileDir));
app.use('/_images', express.static(defaultImagesDir));
app.use('/_widgets', express.static(settings.widgetsFileDir));
app.use('/snapshots', snapshotAuth, express.static(settings.webcamSnapShotsDir));

var accessLogStream = fs.createWriteStream(settings.logDir + '/api.log', { flags: 'a' });
if (runtime.settings.logApiLevel !== 'none') {
	app.use(morgan('combined', {
		stream: accessLogStream,
		skip: function (req, res) { return res.statusCode < 400 }
	}));

	app.use(morgan('dev', {
		skip: function (req, res) {
			return res.statusCode < 400
		}, stream: process.stderr
	}));

	app.use(morgan('dev', {
		skip: function (req, res) {
			return res.statusCode >= 400
		}, stream: process.stdout
	}));
}

function mountSwaggerIfEnabled() {
    const swaggerEnabled = settings.swagger || settings.swaggerEnabled;
    if (!swaggerEnabled) return;

    let swaggerUi;
    let YAML;
    try {
        swaggerUi = require('swagger-ui-express');
        YAML = require('yamljs');
    } catch (err) {
        if (err && err.code !== 'MODULE_NOT_FOUND') {
            throw err;
        }
        logger.warn('[Swagger] Enabled but optional dependencies are missing; skipping /api-docs. Install swagger-ui-express and yamljs to enable it.');
        return;
    }

    const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Swagger API Docs (mounted on main app so it isn't intercepted by optional integrations)
try {
    mountSwaggerIfEnabled();
} catch (err) {
    logger.warn('Swagger UI failed to initialize', err);
}

// app.get('/', function (req, res) {
//     res.sendFile('/index.html');
//     try {
//         var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
//         logger.info("Client connected: " + ip);
//     } catch (err) {

//     }
// })

// set api to listen
// if (settings.disableServer !== false) {
//     app.use('/', FUXA.httpApi);
// }

function getListenPath() {
    var port = settings.serverPort;
    if (port === undefined) {
        port = settings.uiPort;
    }

    var listenBasePath = BASE_PATH || '';
    var listenPath = 'http' + (settings.https ? 's' : '') + '://' +
        (settings.uiHost == '::' ? 'localhost' : (settings.uiHost == '0.0.0.0' ? '127.0.0.1' : settings.uiHost)) +
        ':' + port + listenBasePath;
    if (settings.httpStatic) {
        listenPath += '/';
    }
    return listenPath;
}

let mountNodeRedIfInstalled;
if (settings.nodeRedEnabled) {
    ({ mountNodeRedIfInstalled } = require('./integrations/node-red'));
}

// Start FUXA
function startFuxa() {
    FUXA.start().then(async () => {
        if (settings.httpStatic) {
            server.on('error', function (err) {
                if (err.errno === 'EADDRINUSE') {
                    logger.error('server.port-in-use');
                    logger.error('server.unable-to-listen ', { listenpath: getListenPath() });
                } else {
                    if (err.stack) {
                        logger.error(err.stack);
                    } else {
                        logger.error('server.error ' + err);
                    }
                }
                process.exit(1);
            });

            // Mount Node-RED if present; never block FUXA if it fails
            if (settings.nodeRedEnabled && typeof mountNodeRedIfInstalled === 'function') {
                try {
                    await mountNodeRedIfInstalled({ app, server, settings, runtime, logger, authJwt, events });
                } catch (e) {
                    logger.warn('[Node-RED] Failed to initialize, continuing without it.', e);
                }
            } else if (settings.nodeRedEnabled) {
                logger.warn('[Node-RED] Enabled but integration not available; continuing without it.');
            }

            if (settings.disableServer !== false) {
                const bodyParser = require('body-parser');
                app.use(bodyParser.json());

                const handleCustomSubpath = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    try {
                        const newSub = '/' + (req.body.subpath || '').replace(/^\/+|\/+$/g, '');
                        const currentPort = settings.serverPort || settings.uiPort;
                        if (!newSub) return res.status(400).json({ error: 'Missing subpath' });

                        const regFiles = [
                            path.resolve(__dirname, '../../manager/registry.json'),
                            path.resolve(__dirname, '../../instances/registry.json')
                        ];

                        for (const rf of regFiles) {
                            try {
                                let reg = { plants: {}, divisions: {}, instances: {} };
                                if (fs.existsSync(rf)) {
                                    reg = JSON.parse(fs.readFileSync(rf, 'utf8'));
                                }
                                reg.instances = reg.instances || {};
                                let found = false;
                                for (const [k, inst] of Object.entries(reg.instances)) {
                                    if (inst.port === currentPort) {
                                        inst.subpath = newSub;
                                        inst.editor_url = `${newSub}/editor`;
                                        inst.home_url = `${newSub}/home`;
                                        if (req.body.name) {
                                            inst.name = req.body.name;
                                        }
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found) {
                                    reg.instances[`port_${currentPort}`] = {
                                        id: `port_${currentPort}`,
                                        port: currentPort,
                                        subpath: newSub,
                                        name: req.body.name || `Custom Line (${newSub})`,
                                        editor_url: `${newSub}/editor`,
                                        home_url: `${newSub}/home`
                                    };
                                }
                                if (!fs.existsSync(path.dirname(rf))) {
                                    fs.mkdirSync(path.dirname(rf), { recursive: true });
                                }
                                const tmpFile = rf + '.tmp';
                                fs.writeFileSync(tmpFile, JSON.stringify(reg, null, 2));
                                fs.renameSync(tmpFile, rf);
                            } catch (err) {}
                        }

                        // Persist project name directly in SQLite database
                        if (req.body.name) {
                            try {
                                const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                                if (fs.existsSync(dbFile)) {
                                    const sqlite3 = require('sqlite3').verbose();
                                    const db = new sqlite3.Database(dbFile);
                                    db.serialize(() => {
                                        db.run("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ['name', JSON.stringify(req.body.name)]);
                                        db.get("SELECT value FROM general WHERE name = 'general';", (err, row) => {
                                            if (row && row.value) {
                                                try {
                                                    const g = JSON.parse(row.value);
                                                    g.title = req.body.name;
                                                    if (g.header) g.header.title = req.body.name;
                                                    db.run("UPDATE general SET value = ? WHERE name = 'general';", [JSON.stringify(g)]);
                                                } catch (e) {}
                                            }
                                        });
                                    });
                                    db.close();
                                    logger.info(`[FUXA-Database] Updated project name to "${req.body.name}" in ${dbFile}`);
                                }
                            } catch (e) {}
                        }

                        // Notify Gateway (80) & Fleet Manager (9000)
                        const http = require('http');
                        const notifyServer = (targetPort, apiPath, postData) => {
                            try {
                                const dataStr = JSON.stringify(postData);
                                const opt = {
                                    hostname: '127.0.0.1',
                                    port: targetPort,
                                    path: apiPath,
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Content-Length': Buffer.byteLength(dataStr)
                                    },
                                    timeout: 1000
                                };
                                const r = http.request(opt, () => {});
                                r.on('error', () => {});
                                r.write(dataStr);
                                r.end();
                            } catch (e) {}
                        };
                        notifyServer(80, '/api/gateway/subpath', { subpath: newSub, port: currentPort, name: req.body.name });
                        notifyServer(9000, '/api/update-subpath', { subpath: newSub, port: currentPort, name: req.body.name });

                        logger.info(`[CustomURL] Saved subpath for port ${currentPort}: ${newSub}`);
                        return res.json({ success: true, subpath: newSub, port: currentPort });
                    } catch (e) {
                        return res.status(500).json({ error: e.message });
                    }
                };

                const handleProjectName = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    const currentPort = settings.serverPort || settings.uiPort;

                    if (req.method === 'GET') {
                        let pName = 'EMS';
                        try {
                            const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                            if (fs.existsSync(dbFile)) {
                                const sqlite3 = require('sqlite3').verbose();
                                const db = new sqlite3.Database(dbFile);
                                db.get("SELECT value FROM general WHERE name = 'name';", (err, row) => {
                                    if (row && row.value) {
                                        try { pName = JSON.parse(row.value); } catch (_) { pName = row.value; }
                                        db.close();
                                        return res.json({ name: pName, port: currentPort });
                                    } else {
                                        db.get("SELECT value FROM general WHERE name = 'general';", (err2, row2) => {
                                            if (row2 && row2.value) {
                                                try {
                                                    const g = JSON.parse(row2.value);
                                                    if (g.title) pName = g.title;
                                                } catch (_) {}
                                            }
                                            db.close();
                                            return res.json({ name: pName, port: currentPort });
                                        });
                                    }
                                });
                                return;
                            }
                        } catch (_) {}
                        return res.json({ name: pName, port: currentPort });
                    }

                    const newName = (req.body.name || '').trim();
                    if (!newName) return res.status(400).json({ error: 'Missing name' });

                    try {
                        const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                        if (fs.existsSync(dbFile)) {
                            const sqlite3 = require('sqlite3').verbose();
                            const db = new sqlite3.Database(dbFile);
                            db.serialize(() => {
                                db.run("INSERT OR REPLACE INTO general (name, value) VALUES (?, ?);", ['name', JSON.stringify(newName)]);
                                db.get("SELECT value FROM general WHERE name = 'general';", (err, row) => {
                                    if (row && row.value) {
                                        try {
                                            const g = JSON.parse(row.value);
                                            g.title = newName;
                                            if (g.header) g.header.title = newName;
                                            db.run("UPDATE general SET value = ? WHERE name = 'general';", [JSON.stringify(g)]);
                                        } catch (e) {}
                                    }
                                    db.get("SELECT value FROM general WHERE name = 'layout';", (err2, row2) => {
                                        if (row2 && row2.value) {
                                            try {
                                                const l = JSON.parse(row2.value);
                                                if (l.header) {
                                                    l.header.title = newName;
                                                    if (Array.isArray(l.header.items)) {
                                                        for (const it of l.header.items) {
                                                            if (it.id === 'header_headline' || it.type === 'label') {
                                                                it.text = newName;
                                                                if (it.property) it.property.text = newName;
                                                            }
                                                        }
                                                    }
                                                }
                                                db.run("UPDATE general SET value = ? WHERE name = 'layout';", [JSON.stringify(l)]);
                                            } catch (e) {}
                                        }
                                        db.close();
                                    });
                                });
                            });
                            logger.info(`[FUXA-Database] Updated project name to "${newName}" in ${dbFile}`);
                        }
                    } catch (e) {}

                    // Update registry files
                    const regFiles = [
                        path.resolve(__dirname, '../../manager/registry.json'),
                        path.resolve(__dirname, '../../instances/registry.json')
                    ];
                    for (const rf of regFiles) {
                        try {
                            if (fs.existsSync(rf)) {
                                let reg = JSON.parse(fs.readFileSync(rf, 'utf8'));
                                if (reg.instances) {
                                    for (const [k, inst] of Object.entries(reg.instances)) {
                                        if (inst.port === currentPort) {
                                            inst.name = newName;
                                            break;
                                        }
                                    }
                                    const tmpFile = rf + '.tmp';
                                    fs.writeFileSync(tmpFile, JSON.stringify(reg, null, 2));
                                    fs.renameSync(tmpFile, rf);
                                }
                            }
                        } catch (_) {}
                    }

                    if (!req.body.from_manager) {
                        const http = require('http');
                        const notifyServer = (targetPort, apiPath, postData) => {
                            try {
                                const dataStr = JSON.stringify(postData);
                                const opt = {
                                    hostname: '127.0.0.1',
                                    port: targetPort,
                                    path: apiPath,
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Content-Length': Buffer.byteLength(dataStr)
                                    },
                                    timeout: 1000
                                };
                                const r = http.request(opt, () => {});
                                r.on('error', () => {});
                                r.write(dataStr);
                                r.end();
                            } catch (e) {}
                        };
                        notifyServer(9000, '/api/update-subpath', { port: currentPort, subpath: BASE_PATH || '/', name: newName, from_fuxa: true });
                    }

                    return res.json({ success: true, name: newName, port: currentPort });
                };

                app.all('/api/project-name', handleProjectName);
                if (BASE_PATH) {
                    app.all(BASE_PATH + '/api/project-name', handleProjectName);
                }

                app.post('/api/custom-subpath', handleCustomSubpath);
                if (BASE_PATH) {
                    app.post(BASE_PATH + '/api/custom-subpath', handleCustomSubpath);
                }

                const DIVISIONS_MAP = {
                    1: "Body Shop",
                    2: "Stamping",
                    3: "Assembly",
                    4: "Quality & Inspection",
                    5: "Utility & Boiler",
                    6: "Paintshop",
                    7: "Robotics & Automation",
                    8: "Material Handling"
                };

                const PLANTS_MAP = {
                    1: "Plant 1 - Foundry & Powerhouse",
                    2: "Plant 2 - Stamping & Press",
                    3: "Plant 3 - Body & Assembly",
                    4: "Plant 4 - Powertrain & Engine",
                    9: "Plant 9 - Paintshop Complex"
                };

                const getDeducePlantId = () => {
                    const currentPort = settings.serverPort || settings.uiPort;
                    if (currentPort === 5100) return 1;
                    if (currentPort === 5200) return 2;
                    if (currentPort === 5300) return 3;
                    if (currentPort === 5400) return 4;
                    if (currentPort === 5900) return 9;
                    const pStr = String(currentPort);
                    return (pStr.length >= 4) ? parseInt(pStr[0], 10) : 9;
                };

                const handleStorageTopology = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    const plantId = getDeducePlantId();
                    const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                    if (!fs.existsSync(dbFile)) {
                        return res.json({ plant_id: plantId, plant_name: PLANTS_MAP[plantId] || `Plant ${plantId}`, divisions: DIVISIONS_MAP, devices: [] });
                    }

                    try {
                        const sqlite3 = require('sqlite3').verbose();
                        const db = new sqlite3.Database(dbFile);
                        db.all("SELECT name, value FROM devices;", (err, rows) => {
                            db.close();
                            if (err) return res.status(500).json({ error: err.message });
                            
                            const devTelemetry = (runtime.devices && typeof runtime.devices.getDevicesTelemetry === 'function')
                                ? runtime.devices.getDevicesTelemetry()
                                : {};

                            const devices = [];
                            for (const r of (rows || [])) {
                                if (r.name === 'server') continue;
                                try {
                                    const dev = JSON.parse(r.value);
                                    const telem = devTelemetry[dev.id] || devTelemetry[dev.name] || {};
                                    dev.telemetry = {
                                        connected: !!telem.connected,
                                        connectionStatus: telem.connectionStatus || 'OFF',
                                        lastConnected: telem.lastConnected || null,
                                        lastConnectedFormatted: telem.lastConnectedFormatted || (telem.lastConnected ? new Date(telem.lastConnected).toLocaleString() : 'Never connected'),
                                        reconnectCount: typeof telem.reconnectCount === 'number' ? telem.reconnectCount : 0,
                                        totalConnections: telem.totalConnections || 0
                                    };
                                    devices.push(dev);
                                } catch (_) {}
                            }
                            return res.json({
                                plant_id: plantId,
                                plant_name: PLANTS_MAP[plantId] || `Plant ${plantId}`,
                                divisions: DIVISIONS_MAP,
                                devices: devices
                            });
                        });
                    } catch (e) {
                        return res.status(500).json({ error: e.message });
                    }
                };

                const handleDeviceTelemetry = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    const telem = (runtime.devices && typeof runtime.devices.getDevicesTelemetry === 'function')
                        ? runtime.devices.getDevicesTelemetry()
                        : {};
                    return res.json({ telemetry: telem, serverTime: Date.now() });
                };

                const handleAddTopologyDevice = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    const { name, type, property, topology, enabled } = req.body || {};
                    if (!name || !type) {
                        return res.status(400).json({ error: 'Device name and type are required' });
                    }

                    const plantId = getDeducePlantId();
                    const divId = topology && topology.division ? parseInt(topology.division, 10) : 6;
                    const lineId = topology && topology.line ? parseInt(topology.line, 10) : 1;
                    const devId = `dev_${type.toLowerCase().replace(/[^a-z0-9]/g, '')}_p${plantId}_d${divId}_l${lineId}_${Date.now()}`;

                    const newDevice = {
                        id: devId,
                        name: name.trim(),
                        type: type,
                        enabled: enabled !== false,
                        property: property || {},
                        tags: {},
                        topology: {
                            plant: plantId,
                            division: divId,
                            division_name: DIVISIONS_MAP[divId] || `Division ${divId}`,
                            line: lineId,
                            line_name: `Line ${lineId}`
                        }
                    };

                    const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                    try {
                        const sqlite3 = require('sqlite3').verbose();
                        const db = new sqlite3.Database(dbFile);
                        db.run(
                            "INSERT OR REPLACE INTO devices (name, value, connection, cntid, cntpwd) VALUES (?, ?, ?, ?, ?);",
                            [devId, JSON.stringify(newDevice), type, '', ''],
                            function (err) {
                                db.close();
                                if (err) return res.status(500).json({ error: err.message });
                                logger.info(`[STORAGE-TOPOLOGY] Successfully added field device "${name}" (${type}) to Plant ${plantId} > Div ${divId} > Line ${lineId}`);
                                return res.json({ success: true, device: newDevice });
                            }
                        );
                    } catch (e) {
                        return res.status(500).json({ error: e.message });
                    }
                };

                const handleDeleteTopologyDevice = (req, res) => {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', '*');
                    if (req.method === 'OPTIONS') return res.sendStatus(204);

                    const { id } = req.body || {};
                    if (!id) return res.status(400).json({ error: 'Device id is required' });

                    const dbFile = path.join(settings.workDir, 'project.fuxap.db');
                    try {
                        const sqlite3 = require('sqlite3').verbose();
                        const db = new sqlite3.Database(dbFile);
                        db.run("DELETE FROM devices WHERE name = ?;", [id], function (err) {
                            db.close();
                            if (err) return res.status(500).json({ error: err.message });
                            logger.info(`[STORAGE-TOPOLOGY] Deleted field device: ${id}`);
                            return res.json({ success: true, id: id });
                        });
                    } catch (e) {
                        return res.status(500).json({ error: e.message });
                    }
                };

                app.all('/api/storage/topology', handleStorageTopology);
                app.get('/api/storage/device-telemetry', handleDeviceTelemetry);
                app.post('/api/storage/add-topology-device', handleAddTopologyDevice);
                app.post('/api/storage/delete-topology-device', handleDeleteTopologyDevice);
                if (BASE_PATH) {
                    app.all(BASE_PATH + '/api/storage/topology', handleStorageTopology);
                    app.get(BASE_PATH + '/api/storage/device-telemetry', handleDeviceTelemetry);
                    app.post(BASE_PATH + '/api/storage/add-topology-device', handleAddTopologyDevice);
                    app.post(BASE_PATH + '/api/storage/delete-topology-device', handleDeleteTopologyDevice);
                }

                const STATUTORY_WARNING = "Adding connections facility is no longer supported on View Servers; redirect to storage server instance for adding field PLC or gateway device. Once they added in respective storage server, device will be listed to the view page server automatically.";
                const blockPluginsHandler = (req, res, next) => {
                    if (process.env.STORAGE_SERVER_URL) {
                        return res.status(403).json({ error: "plugins_disabled", message: STATUTORY_WARNING });
                    }
                    next();
                };

                app.post('/api/plugins', blockPluginsHandler);
                app.post('/api/plugins/*', blockPluginsHandler);
                if (BASE_PATH) {
                    app.post(BASE_PATH + '/api/plugins', blockPluginsHandler);
                    app.post(BASE_PATH + '/api/plugins/*', blockPluginsHandler);
                }

                if (BASE_PATH) {
                    app.use(BASE_PATH + '/', FUXA.httpApi);
                }
                app.use('/', FUXA.httpApi);
            }

            server.listen(settings.uiPort, settings.uiHost, function () {
                settings.serverPort = server.address().port;
                process.title = 'FUXA';
                logger.info('WebServer is running ' + getListenPath());
            });
        } else {
            logger.info('server.headless-mode');
        }
    }).catch(function (err) {
        logger.error('server.failed-to-start');
        if (err) {
            if (err.stack) {
                logger.error(err.stack);
            } else {
                logger.error(err);
            }
        }
    });
}

const initWebcamSnapshotCleanup = () => {
    if (!settings.webcamSnapShotsCleanup) {
        return;
    }

    schedule.scheduleJob('0 1 * * *', cleanupSnapShotsFiles);
    logger.info('Scheduled webcam snapshot cleanup at 01:00 daily.');
};

/**
 * Cleanup Snapshots Files
 * @description  start on '0 1 * * *'
 */
const cleanupSnapShotsFiles = async () => {
    const { webcamSnapShotsCleanup, webcamSnapShotsDir, webcamSnapShotsRetain } = settings;

    if (!webcamSnapShotsCleanup) {
        return;
    }

    try {
        const now = Date.now();
        const retentionMillis = webcamSnapShotsRetain * 24 * 60 * 60 * 1000;
        const files = await fs.promises.readdir(webcamSnapShotsDir);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(webcamSnapShotsDir, file);
            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.mtime && (now - stat.mtimeMs > retentionMillis)) {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                }
            } catch (fileErr) {
                logger.error(`Failed to process snapshot file: ${filePath}`, fileErr);
            }
        }

        logger.info(`Snapshot cleanup completed. ${deletedCount} old file(s) deleted.`);
    } catch (err) {
        logger.error('Error during webcam snapshot cleanup', err);
    }
};

// Don't wait any more
setTimeout(() => {
    events.emit('init-runtime-ok');
}, 60000);

process.on('uncaughtException', function (err) {
    if (err.stack) {
        logger.error(err.stack);
    } else {
        logger.error(err);
    }
});

process.on('SIGINT', function () {
    FUXA.stop().then(function () {
        process.exit();
    });
    logger.info('FUXA end!');
    process.exit();
});
