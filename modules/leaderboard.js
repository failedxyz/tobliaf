var async = require("asyncawait/async"), await = require("asyncawait/await");
var Channel = require("../channel");
var common = require("../common");
var User = require("../user");

console.log(Channel, User);

var Leaderboard = function() {}

var experience_to_level = function(xp) {
    var multiplier = 10;
    return Math.floor((Math.sqrt(4 * multiplier * (2 * xp + multiplier)) + 2 * multiplier) / (4 * multiplier));
};

var percent_to_next_level = function(xp) {
    var currentLevel = experience_to_level(xp);
    var prevLevel_xp = 20 * currentLevel * (currentLevel - 1);
    var progress = xp - prevLevel_xp;
    var total = 20 * currentLevel * (currentLevel + 1) - prevLevel_xp;
    return progress * 1.0 / total;
};

Leaderboard.get = function(cid) {
    var entries = common.db.get("stats").filter({
        cid: cid
    }).value();
    entries.sort(function(a, b) {
        return b.experience - a.experience
    });
    return entries;
};

Leaderboard.rank = function(uid, cid) {
    var scores = Leaderboard.get(cid);
    var entry = common.db.get("stats").find({
        uid: uid,
        cid: cid
    }).value();
    return scores.indexOf(entry) + 1;
};

Leaderboard.onMessageReceived = function(user, channel) {
    var entry = common.db.get("stats").find({
        uid: user.id,
        cid: channel.id
    }).value();
    if (entry) {
        common.db.get("stats").chain()
            .find({
                uid: user.id,
                cid: channel.id
            })
            .assign({
                activity: 10
            })
            .value();
    } else {
        common.db.get("stats").push({
            uid: user.id,
            cid: channel.id,
            activity: 10,
            experience: 0
        }).value();
    }
};

Leaderboard.everyMinute = async(function(time) {
    var before = [],
        after = [];
    var channels = common.db.get("channels").filter({}).value();
    for (var i = 0; i < channels.length; i++) {
        var users = common.db.get("stats").filter({
            cid: channels[i].cid
        }).sort(function(a, b) {
            return a.experience - b.experience;
        }).value();
        var Q = [];
        for (var j = 0; j < users.length; j++) {
            before.push({
                uid: users[j].uid,
                cid: channels[i].cid,
                better_than: Q.slice(0)
            });
            Q.push(users[j].uid);
        }
    }
    before = before.sort(function(a, b) {
        return (a.uid != b.uid) ? a.uid - b.uid : a.cid - b.cid;
    });
    common.db.get("stats").filter({}).value().forEach(function(obj) {
        var experience = obj.experience + 0.5 * obj.activity;
        if (experience_to_level(experience) > experience_to_level(obj.experience)) {
            common.ws.sendMessage(`<@${obj.uid}> ranked up to level ${experience_to_level(experience)}!`, obj.cid);
        }
        common.db.get("stats").chain()
            .find({
                uid: obj.uid,
                cid: obj.cid
            })
            .assign({
                activity: (obj.activity == 0) ? 0 : obj.activity - 1,
                experience: experience
            })
            .value();
    });
    for (var i = 0; i < channels.length; i++) {
        var users = common.db.get("stats").filter({
            cid: channels[i].cid,
        }).sort(function(a, b) {
            return a.experience - b.experience;
        }).value();
        var Q = [];
        for (var j = 0; j < users.length; j++) {
            after.push({
                uid: users[j].uid,
                cid: channels[i].cid,
                better_than: Q.slice(0)
            });
            Q.push(users[j].uid);
        }
    }
    after = after.sort(function(a, b) {
        return (a.uid != b.uid) ? a.uid - b.uid : a.cid - b.cid;
    });
    var messages = {};
    for (var i = 0; i < before.length; i++) {
        if (after[i].better_than.length > before[i].better_than.length) {
            var beat = [];
            for (var j = 0; j < after[i].better_than.length; j++) {
                if (before[i].better_than.indexOf(after[i].better_than[j]) < 0) {
                    beat.push(await (User.get_user(after[i].better_than[j])).name);
                }
            }
            if (!(before[i].cid in messages)) messages[before[i].cid] = [];
            messages[before[i].cid].push(await (User.get_user(before[i].uid)).name + " beat " + beat.join(", ") + "!");
        }
    }
    for (var thread in messages) {
        common.ws.sendMessage(messages[thread].join("\n"), thread);
    }
});

Leaderboard.levelHook = async(function(user, channel, args) {
    var search = user.id;
    if (args.length > 1) {
        var user_info = await (User.get_user_by({
            firstName_lower: args[1].toLowerCase()
        }));
        if (!user_info) user_info = await (User.get_user_by({
            name_lower: args[1].toLowerCase()
        }));
        if (user_info) search = user_info.uid;
    }
    var entry = common.db.get("stats").find({
        uid: search,
        cid: channel.id
    }).value() || {
        activity: 10,
        experience: 0
    };
    var user_info = await (User.get({
        id: search
    }));
    var experience = ~~(entry.experience * 100) / 100;
    var rank = Leaderboard.rank(search, channel.id);
    var percent = ~~(percent_to_next_level(experience) * 10000) / 100;
    if (user.id == search) {
        common.ws.sendMessage(`<@${user.id}>: You're rank #${rank} at level ${experience_to_level(experience)} (${experience}xp, ${percent}%)`, channel.id);
    } else {
        common.ws.sendMessage(`<@${user.id}> is rank #${rank} at level ${experience_to_level(experience)} (${experience}xp, ${percent}%)`, channel.id);
    }
});

Leaderboard.rankHook = async(function(user, channel, args) {
    try {
        if (args.length < 2) throw "";
        var num = parseInt(args[1]);
        var leaderboard = Leaderboard.get(channel.id);
        if (num <= 0) {
            return common.ws.sendMessage("Let's keep the ranks positive, thanks.", channel.id);
        } else if (num > leaderboard.length) {
            return common.ws.sendMessage("There aren't that many positions!", channel.id);
        }
        var entry = leaderboard[num - 1];
        var user = await (User.get({ id: entry.uid }));
        return common.ws.sendMessage(`<@${user.id}> is in rank #${num} with ${(~~(entry.experience * 100) / 100)}xp.`, channel.id);
    } catch (e) {
        console.log("Error: " + e);
        common.ws.sendMessage("Failed to find position.", channel.id);
    }
});

Leaderboard.leaderboardHook = async(function(user, channel, args) {
    var leaderboard = Leaderboard.get(channel.id);
    console.log(leaderboard);
    var people = [];
    for (var i = 0; i < leaderboard.length; i++) {
        var entry = leaderboard[i];
        var user = await (User.get({
            id: entry.uid
        }));
        people.push(`#${i + 1}: ${user.name} (${(~~(entry.experience * 100) / 100)}xp${i < leaderboard.length - 1 ? ", +" + (~~((entry.experience - leaderboard[i + 1].experience) * 100) / 100) + "xp" : ""})`);
    }
    var message = people.join("\n") + "\n";
    common.ws.sendMessage(message, user.id);
});

Leaderboard.metadata = {
    "events": {
        "onMessageReceived": Leaderboard.onMessageReceived,
        "everyMinute": Leaderboard.everyMinute,
    },
    "commands": {
        "level": Leaderboard.levelHook,
        "rank": Leaderboard.rankHook,
        "leaderboard": Leaderboard.leaderboardHook
    }
};

module.exports = Leaderboard;