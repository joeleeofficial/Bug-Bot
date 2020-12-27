"use strict";
const config = require("../config");
const utils = require("./utils");
const sections = require('./getSections');

function getBug (bot, channelID, userID, command, msg, db) {
  let receivedMessage;
  if(!!command) {
    let messageSplit = msg.content.split(' ');
    messageSplit.shift();
    receivedMessage = messageSplit.join(' ');

    if(!receivedMessage) {
      utils.botReply(bot, userID, channelID, "psst, I think you forgot the bug ID", command, msg.id, false);
      return;
    }
  } else {
    receivedMessage = userID; // if denied report, this is the key
  }

  db.get("SELECT * FROM reports WHERE id = ?", [receivedMessage], function(error, reportInfo) {
    if(!reportInfo) {return;}

    let allSections = sections(reportInfo.reportString);

    let stepsToRepro = allSections["steps to reproduce"];
    stepsToRepro = stepsToRepro.replace(/(-)\s/gi, '\n$&');
    let expectedResult = allSections["expected result"];
    let actualResult = allSections["actual result"];
    let clientSetting = allSections["client setting"];
    let sysSettings = allSections["system setting"];

    db.all("SELECT * FROM reportQueueInfo WHERE id = ? AND stance != 'note'", [receivedMessage], function(error, reportRepro) {
      if(!reportRepro) {return;}

      let stance;
      let getRepro = reportRepro.map(function(everyRepro) {
        if(everyRepro.stance === "approve") {
          stance = "<:greenTick:" + config.emotes.greenTick + ">";
        } else {
          stance = "<:redTick:" + config.emotes.redTick + ">";
        }
        return stance + " **" + utils.cleanUserTag(everyRepro.userTag) + "**(`" + everyRepro.userID + "`): `" + everyRepro.info + "`";
      });

      let trelloURL = "";
      if(!!reportInfo.trelloURL) {
        trelloURL = "- <https://trello.com/c/" + reportInfo.trelloURL + ">";
      }

      let originLocation;
      switch (reportInfo.cardID) {
        case config.cards.canaryCard:
          originLocation = config.channels.canaryChannel;
          break;
        case config.cards.linuxCard:
          originLocation = config.channels.linuxChannel;
          break;
        case config.cards.iosCard:
          originLocation = config.channels.iosChannel;
          break;
        case config.cards.androidCard:
          originLocation = config.channels.androidChannel;
          break;
      }

      let queueReportString = `\n**Short description:** ${reportInfo.header}\n**Steps to reproduce:** ${stepsToRepro}\n**Expected result:** ${expectedResult}\n**Actual result:** ${actualResult}\n**Client settings:** ${clientSetting}\n**System settings:** ${sysSettings}`;
      let messageToSend = `───────────────────────\n<#${originLocation}>: **#${receivedMessage}** ${trelloURL}\n**${utils.cleanUserTag(reportInfo.userTag)}** Reported:\n${queueReportString}\n\n${getRepro.join('\n')}`;

      if(!!command) {
        bot.getDMChannel(userID).then((getID) => {
          bot.createMessage(getID.id, messageToSend).catch((err) => {console.log("getBug | createMsg\n" + err);});
          bot.deleteMessage(channelID, msg.id).catch(() => {});
        }).catch((error) => {console.log("getBug ERR:\n" + error);});
      } else {
        bot.createMessage(channelID, messageToSend).catch((err) => {console.log("deniedBug | createMsg\n" + err);});
      }
    });
  });
}

function getStats (bot, channelID, userTag, userID, command, msg, trello, db, time) {
  return new Promise((resolve, reject) => {
    time = time || "7";
    db.all('SELECT * FROM reports', function (err, data) {
      if(!!err) reject(err);

      let infObj = {
        totalUsed: 0,
        totalApp: 0,
        totalDen: 0,
        ios: 0,
        linux: 0,
        canary: 0,
        droid: 0,
        time: time
      };

      data.forEach(function(elm) {
        let d = new Date(elm.timestamp);
        let cd = new Date();

        let ts = (Math.floor(cd - d)) / (1000 * 60 * 60 * 24);

        if(time > ts) {
          infObj.totalUsed = ++infObj.totalUsed;
          if(elm.reportStatus === 'trello') infObj.totalApp = ++infObj.totalApp;
          if(elm.reportStatus === 'closed') infObj.totalDen = ++infObj.totalDen;

          switch (elm.cardID) {
            case config.cards.iosCard:
              infObj.ios = ++infObj.ios;
            break;

            case config.cards.linuxCard:
              infObj.linux = ++infObj.linux;
            break;

            case config.cards.canaryCard:
              infObj.canary = ++infObj.canary;
            break;

            case config.cards.androidCard:
              infObj.droid = ++infObj.droid;
            break;
          }
        }
      });
      resolve(infObj);
    });
  });
}

function getUser (bot, channelID, userTag, userID, command, msg, trello, db) {

}

module.exports = {
  getBug: getBug,
  getStats: getStats,
  getUser: getUser
}
