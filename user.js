var async = require("asyncawait/async"), await = require("asyncawait/await");
var common = require("./common");
var promisify = require("deferred").promisify;
var request = require("request");

require("dotenv").load();

var User = function() {}
User.prototype.constructor = User;

User.get = async(function(search) {
    var info = common.db.get("users").find(search).value() || {};
    if (info && Date.now() < info.expires) {
        return info;
    } else if (search.id) {
        var user = await (User.fetch(search.id));
        for (var prop in user) {
            info[prop] = user[prop];
        }
        info.expires = Date.now() + 5 * 60 * 60 * 1000;
        common.db.get("users").remove({
            id: search.id
        }).value();
        common.db.get("users").push(info).value();
        return info;
    }
    return {};
});

User.fetch = async(function(user) {
    var [error, response, body] = await (promisify(request.get)(`https://slack.com/api/users.info?user=${user}&token=${process.env.API_TOKEN}`));
    var data = JSON.parse(response);
    return data.user;
});

module.exports = User;