var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var promisify = require("deferred").promisify;
var request = require("request");

require("dotenv").load();

var Channel = function() {}
Channel.prototype.constructor = Channel;

Channel.get = async(function(search) {
    var info = common.db.get("channels").find(search).value() || {};
    if (info && Date.now() < info.expires) {
        return info;
    } else if (search.id) {
        var channel = await (Channel.fetch(search.id));
        for (var prop in channel) {
            info[prop] = channel[prop];
        }
        info.expires = Date.now() + 5 * 60 * 60 * 1000;
        common.db.get("channels").remove({
            id: search.id
        }).value();
        common.db.get("channels").push(info).value();
        return info;
    }
    return {};
});

Channel.fetch = async(function(channel) {
    var [error, response, body] = await (promisify(request.get)(`https://slack.com/api/channels.info?channel=${channel}&token=${process.env.API_TOKEN}`));
    var data = JSON.parse(response);
    return data.channel;
});

module.exports = Channel;