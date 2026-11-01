/**
 * 'api/plugin': Plugin API to GET/POST plugin data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var pluginsApp = express();
        pluginsApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET supported Plugin and status (installed) 
         */
        pluginsApp.get("/api/plugins", secureFnc, function (req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get plugins: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get plugins: Unauthorized!");
            } else {
                runtime.plugins.getPlugins().then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api get plugins: " + err.message);
                });
            }
        });

        /**
         * POST Plugin
         * Install the plugin
         */
        pluginsApp.post("/api/plugins", secureFnc, function (req, res, next) {
            return res.status(403).json({
                error: "plugins_disabled",
                message: "Adding connections facility is no longer supported; redirect to storage server instance for adding field PLC or gateway device. Once they added in respective storage server, device will be listed to the view page server automatically."
            });
        });

        /**
         * DELETE Plugin
         * Unistall the plugin
         */
        pluginsApp.delete("/api/plugins", secureFnc, function (req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete plugins: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api delete plugins: Unauthorized");
            } else {
                runtime.plugins.removePlugin(req.query.param).then(function (data) {
                    res.end();
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                    }
                    runtime.logger.error("api delete plugins: " + err.message);
                });
            }
        });
        return pluginsApp;
    }
}