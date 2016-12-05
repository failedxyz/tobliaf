var async = require("asyncawait/async"), await = require("asyncawait/await");
var fs = require("fs");
var low = require("lowdb");
var path = require("path");
var storage = require("lowdb/lib/file-sync");

exports.db = low("db.json", {
    storage: storage
});
exports.db.defaults({
    channels: [],
    stats: [],
    users: [],
}).value();

const EVENTS = ["onMessageReceived", "everyMinute"];
(function() {
    var module, modules = {},
        commands = {};
    var moduleList = fs.readdirSync("modules").forEach(function(file) {
        if (!file.endsWith(".js")) return false;
        try {
            var module = require("./" + path.join("modules", file));
            if (!("metadata" in module)) throw "No metadata found.";
            var meta = module.metadata;

            if ("events" in meta) {
                for (var evt in meta.events) {
                    if (typeof meta.events[evt] != "function") throw `Event '${evt}' isn't valid.`;
                }
            }
            if ("commands" in meta) {
                for (var command in meta.commands) {
                    if (typeof meta.commands[command] != "function") throw `Hook '${meta.commands[command]}' isn't valid.`;
                    commands[command] = meta.commands[command];
                }
            }
        } catch (e) {
            console.error(`Module ${file} not loaded: ${e}`);
            return false;
        }
        console.log(`Loaded module: ${file}`);
        return modules[file.replace(".js", "")] = module;
    });
    exports.modules = modules;
    exports.commands = commands;
})();