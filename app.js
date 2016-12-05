var async = require("asyncawait/async"), await = require("asyncawait/await");
var Channel = require("./channel");
var common = require("./common");
var parse = require("shell-quote").parse;
var promisify = require("deferred").promisify;
var request = require("request");
var User = require("./user");
var WebSocket = require("ws");

require("dotenv").load();
const TRIGGER = "!";

var intval = setInterval(async(function() {
    var timestamp = Date.now();
    // everyMinute
    for (var moduleName in common.modules) {
        var module = common.modules[moduleName];
        if ("events" in module.metadata && "everyMinute" in module.metadata.events) {
            await (module.metadata.events.everyMinute(timestamp));
        }
    }
}), 60000);

var handle = async(function(data) {
    data = JSON.parse(data);
    console.log(data, data.type);
    try {
        switch (data.type) {
            case "message":
                var user = await (User.get({
                    id: data.user
                }));
            	if (user.id == "U3ALN4S59") break;
                var channel = await (Channel.get({
                    id: data.channel
                }));
                for (var moduleName in common.modules) {
                    var module = common.modules[moduleName];
                    if ("events" in module.metadata && "onMessageReceived" in module.metadata.events) {
                        module.metadata.events.onMessageReceived(user, channel);
                    }
                }
                if (data.text.startsWith(TRIGGER)) {
                    var command = data.text.substring(TRIGGER.length).split(" ")[0].toLowerCase();
                    var args = parse(data.text.substring(TRIGGER.length));
                    for (var cmd in common.commands) {
                        if (cmd == command) {
                            await (common.commands[cmd](user, channel, args));
                        }
                    }
                }
            default:
                break;
        }
    } catch (e) {
        console.log(e);
    }
});

var sendMessage = async(function(message, destination) {
    common.ws.send(JSON.stringify({
        type: "message",
        channel: destination,
        text: message
    }));
});

(async(function() {
    var [error, response, body] = await (promisify(request.get)(`https://slack.com/api/rtm.start?token=${process.env.BOT_TOKEN}`));
    var data = JSON.parse(response);
    var ws_url = data.url;
    common.ws = new WebSocket(ws_url);
    common.ws.on("message", handle);
    common.ws.sendMessage = sendMessage;
}))();