"use strict";
const config = require("../config");
const utils = require("../src/utils");
const modUtils = require('../src/modUtils');
const fs = require('fs');
const dateFormat = require('dateformat');

let modCommands = {
  pattern: /!ping|!bug|!restart|!getuser|!getrepro|!getnumber|!report|!backup|!log/i,
  execute: function(bot, channelID, userTag, userID, command, msg, trello, db) {
    let messageSplit = msg.content.split(' ');
    messageSplit.shift();
    let recievedMessage = messageSplit.join(' ');
    let contentMessage = recievedMessage.match(/(\d*)\s*\|\s*([\s\S]*)/i);
    let currentTime = new Date();
      switch (command.toLowerCase()) {
        case "!ping":
          utils.botReply(bot, userID, channelID, "Pong! <:greenTick:" + config.emotes.greenTick + ">", command, msg.id, false);
        break;

        case "!bug":
          modUtils.getBug(bot, channelID, userID, command, msg, db);
          //DM person everything about a report
          break;

        case "!restart":
          let backupFormattedTime = dateFormat(currentTime, "UTC:mm-dd-yyyy-HH-MM");
          let backupFile = fs.readFileSync('./data/data.sqlite');

          bot.createMessage(channelID, "Restarting...").then(() => {
            console.log("Restarting");
            bot.createMessage(config.channels.modLogChannel, `:large_blue_diamond: ${userTag} used restart! It was... hopefully super effective!`, {file: backupFile, name: "Backup-" + backupFormattedTime + ".sqlite"}).then(() => {
              process.exit();
            });
            //restart the bot
          }).catch(() => {});
          break;

        case "!getuser":
          db.all("SELECT * FROM users WHERE userid = ?", [recievedMessage], function(error, data) {
            //bot.getDMChannel(userID).then((dmChannel) => {
            //  bot.createMessage(dmChannel.id, data);
            //}).catch((error) => {console.log(error);})
            console.log(data);
          });
          break;

        case "!getrepro":
          db.all("SELECT * FROM reportQueueInfo WHERE id = ?", [recievedMessage], function(error, data) {
            console.log(data);
          });
          break;

        case "!getnumber":
          db.get("SELECT cantRepro, canRepro, id FROM reports WHERE id = ?", [recievedMessage], function(error, data) {
            console.log(data);
          });
          break;

        case "!report":
          modUtils.getStats (bot, channelID, userTag, userID, command, msg, trello, db, recievedMessage).then(statsObj => {
            let statsFormattedTime = dateFormat(currentTime, "UTC:mm-dd-yyyy HH:MM:ss");
            let statsEmbed = {
              title: 'Stats over the last ' + statsObj.time + ' days:', description: `**Total times used:** ${statsObj.totalUsed}\n**Total number of approved reports:** ${statsObj.totalApp}\n**Total number of denied reports:** ${statsObj.totalDen}\n**iOS reports:** ${statsObj.ios}\n**Android reports:** ${statsObj.droid}\n**Linux reports:** ${statsObj.linux}\n**Canary reports:** ${statsObj.canary}`, color: 7506394, footer: {text: `Checked: ${statsFormattedTime} UTC`}
            }
            bot.createMessage(channelID, {content: " ", embed: statsEmbed});

          })
          break;

        case "!backup":
          let now = new Date();
          let thisCycle = dateFormat(now, "UTC:mm-dd-yyyy-HH-MM");
          let bufferString = fs.readFileSync('./data/data.sqlite');

          bot.createMessage(config.channels.modLogChannel, null, {file: bufferString, name: "Backup-" + thisCycle + ".sqlite"});
          break;

        case "!log":
          if(userID === "84815422746005504") {
            let now = new Date();
            let thisCycle = dateFormat(now, "UTC:mm-dd-yyyy-HH-MM");
            let bufferString = fs.readFileSync('./logs/bblog.log');
            if(!!msg.channel.guild) {
              bot.getDMChannel(userID).then((thisDM) => {
                bot.createMessage(thisDM.id, null, {file: bufferString, name: "log-" + thisCycle + ".log"}).catch((error) => {console.log(error);});
              });
            } else {
              bot.createMessage(channelID, null, {file: bufferString, name: "log-" + thisCycle + ".log"}).catch((error) => {console.log(error);});
            }
          }
          break;
      }
  },
  roles: [
    config.roles.adminRole,
    config.roles.devRole,
    config.roles.trelloModRole
    ],
  channels: [
    config.channels.allChannels
  ],
  acceptFromDM: true
}
module.exports = modCommands;
