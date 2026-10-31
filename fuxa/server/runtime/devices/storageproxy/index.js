/**
 * 'StorageProxy': FUXA Storage Server Proxy Driver
 * Seamlessly consumes live tag values from the Plant Storage Server
 * using the EXACT same device IDs and tag IDs from existing project.json.
 * 
 * - 100% compatibility with existing dashboards (No remapping needed!)
 * - Zero duplicate PLC polling
 * - Zero duplicate InfluxDB logging
 */

'use strict';

const http = require('http');
const https = require('https');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function StorageProxy(_data, _logger, _events, _manager, _runtime) {
    var data = JSON.parse(JSON.stringify(_data));
    var logger = _logger;
    var events = _events;
    var runtime = _runtime;
    var varsValue = {};
    var lastTimestampValue = Date.now();
    var working = false;
    var connected = false;

    var storageUrl = process.env.STORAGE_SERVER_URL || 'http://127.0.0.1:5100';

    this.init = function (_type) {
    };

    this.connect = function () {
        return new Promise((resolve) => {
            connected = true;
            logger.info(`'${data.name}' connected via Storage Proxy -> ${storageUrl}`);
            events.emit('device-status:changed', { id: data.id, status: 'connect-ok' });
            resolve();
        });
    };

    this.disconnect = function () {
        return new Promise((resolve) => {
            connected = false;
            events.emit('device-status:changed', { id: data.id, status: 'connect-off' });
            resolve(true);
        });
    };

    this.polling = async function () {
        if (!connected) return;
        try {
            // Poll tag values from storage server
            const url = new URL('/api/project', storageUrl);
            const client = url.protocol === 'https:' ? https : http;

            client.get(url.href, { timeout: 2500 }, (res) => {
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const prj = JSON.parse(rawData);
                            const remoteDev = prj.devices && prj.devices[data.id];
                            if (remoteDev && remoteDev.tags) {
                                let changed = {};
                                const now = Date.now();
                                for (let tagId in remoteDev.tags) {
                                    const rTag = remoteDev.tags[tagId];
                                    if (rTag && rTag.value !== undefined) {
                                        varsValue[tagId] = {
                                            id: tagId,
                                            value: rTag.value,
                                            type: rTag.type,
                                            timestamp: rTag.timestamp || now
                                        };
                                        changed[tagId] = varsValue[tagId];
                                    }
                                }
                                lastTimestampValue = now;
                                if (!utils.isEmptyObject(changed)) {
                                    events.emit('device-value:changed', { id: data.name, values: changed });
                                }
                            }
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                });
            }).on('error', (err) => {
                // storage server might be restarting
            });
        } catch (err) {
            // ignore network transient errors
        }
    };

    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        data.tags = data.tags || {};
        varsValue = {};
        for (let id in data.tags) {
            varsValue[id] = {
                id: id,
                value: data.tags[id].value !== undefined ? data.tags[id].value : null,
                type: data.tags[id].type
            };
        }
        logger.info(`'${data.name}' StorageProxy loaded ${Object.keys(data.tags).length} tags`);
    };

    this.getValues = function () {
        return varsValue;
    };

    this.getValue = function (id) {
        return varsValue[id] || null;
    };

    this.getStatus = function () {
        return connected ? 'connect-ok' : 'connect-off';
    };

    this.getTagProperty = function (id) {
        return data.tags && data.tags[id] ? data.tags[id] : null;
    };

    this.setValue = function (tagid, value) {
        // Forward setpoint write to Storage Server
        try {
            const url = new URL('/api/setTagValue', storageUrl);
            const client = url.protocol === 'https:' ? https : http;
            const payload = JSON.stringify({ deviceId: data.id, tagId: tagid, value: value });
            
            const req = client.request(url.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            });
            req.write(payload);
            req.end();
        } catch (e) {
            logger.error(`StorageProxy setValue forward error: ${e}`);
        }
    };

    this.isConnected = function () {
        return connected;
    };

    this.bindAddDaq = function (fnc) {
        // DAQ disabled on view server to prevent duplicate InfluxDB logging
        this.addDaq = null;
    };

    this.lastReadTimestamp = function () {
        return lastTimestampValue;
    };

    this.getTagDaqSettings = function (tagId) {
        return null;
    };

    this.setTagDaqSettings = function (tagId, settings) {
    };
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events, manager, runtime) {
        return new StorageProxy(data, logger, events, manager, runtime);
    }
};
