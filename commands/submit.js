"use strict";
const config = require("../config");
const queueUtils = require("../src/queueUtils");
const sections = require("../src/getSections");
const utils = require("../src/utils");

function checkSectionsExist(userID, report, channelID, sectionNames, db) {
  let promise = new Promise((resolve, reject) => {

    if(!sectionNames.has('steps to reproduce')) {
      reject("you need to include `Steps to Reproduce: - step one - step two - step three (etc)`");
    }

    if(!sectionNames.has('expected result')) {
      reject("you need to include `Expected Result:`");
    }

    if(!sectionNames.has('actual result')) {
      reject("you need to include `Actual Result:`");
    }

    if(!sectionNames.has('client setting')) {
      reject("you need to include `Client Settings:`");
    }

    if(!sectionNames.has('system setting')) {
      //check if user has system settings in database
      //if not tell them to include system settings
      let whichOS;
      if(channelID === config.channels.androidChannel) {
        whichOS = "android";
      } else if(channelID === config.channels.canaryChannel) {
        whichOS = "windows, macOS";
      } else if(channelID === config.channels.linuxChannel) {
        whichOS = "linux";
      } else if(channelID === config.channels.iosChannel) {
        whichOS = "ios";
      }

      db.get("SELECT " + whichOS + " FROM users WHERE userid = ?", [userID], function(error, dbReplySI) {
        if(!!error) {
          console.log(error);
        }
        if(!!dbReplySI) {
          //Grab system settings for x user from database
          if(channelID === config.channels.canaryChannel) {
            if(!!dbReplySI.windows && !!dbReplySI.macOS) {
              reject("Because you have multiple different OS versions stored, you need to specify which one you're referring to. Just add `-w` for Windows or `-m` for Mac!`"); // needs fancy string - bug Dabbit
            } else {
              let os = dbReplySI.windows || dbReplySI.macOS;

              if(!os){
                reject("please add your system settings with `!storeinfo <flag> | <info>` or manually add it to the report with `System Settings: info`");
              }

              let sysSettings = " system settings: " + os;
              resolve(sysSettings);
            }
          } else {
            if(!dbReplySI[whichOS]) {
              reject("please add your system settings with `!storeinfo <flag> | <info>` or manually add it to the report with `System Settings: info`");
            }
            let sysSettings = " system settings: " + dbReplySI[whichOS];
            resolve(sysSettings);
          }
        }else if(!dbReplySI) {
          //Tell user to manually add system settings or store it in the bot
          reject("please add your system settings with `!storeinfo <flag> | <info>` or manually add it to the report with `System Settings: info`");
        }
      });
    } else {
      resolve("");
    }
  });
  return promise;
}

let map = new Map();
let submitCommand = {
  pattern: /!submit|!sumbit/i,
  execute: function(bot, channelID, userTag, userID, command, msg, trello, db) {
    if(map.has(userID)) {
      return;
    }

    let msgID = msg.id;
    var messageSplit = msg.content.split(' ');
    messageSplit.shift();
    let joinedMessage = messageSplit.join(' ');

    switch (command.toLowerCase()) {
      case "!submit":

        let splitter = msg.content.match(/\|/g);

        const pipe = joinedMessage.indexOf("|");
        const header = joinedMessage.substr(0, pipe).trim();
        let report = joinedMessage.substr(pipe + 1).trim();

        if(!splitter || splitter.length > 1) {
          utils.botReply(bot, userID, channelID, "your syntax seems to be a bit off. Please read through <#342060723721207810> for a full explanation on my usage.", command, msg.id, true);
          return;
        }

        if(!header) {
          utils.botReply(bot, userID, channelID, "please include a short description of your problem to use as a title! `<short descriptions of the problem>` followed by a pipe `|`!", command, msg.id, true);
          return;
        }
        
        let reportCapLinks = report.replace(/([--:\w?@%&+~#=]*\.[a-z]{2,4}\/{0,2}(?:[?&](?:\w+)=(?:\w+)+|[--:\w?@%&+~#=]+)?)/gi, "");

        const regPattern = /\b(steps to reproduce|expected result|actual result|client setting|system setting)s?:?/gi;
        let matches;
        let sectionNames = new Set();

        while(matches = regPattern.exec(reportCapLinks)) {
          sectionNames.add(matches[1].toLowerCase());
        }

        reportCapLinks = utils.cleanText(reportCapLinks, false);

        checkSectionsExist(userID, reportCapLinks, channelID, sectionNames, db).then((extraSystemSettings) => {
          let newReportString = reportCapLinks + extraSystemSettings;
          let allSections = sections(newReportString, msg, bot);

          let stepsToRepro = allSections["steps to reproduce"];
          stepsToRepro = stepsToRepro.replace(/(-)\s/gi, '\n$&');
          let expectedResult = allSections["expected result"];
          let actualResult = allSections["actual result"];
          let clientSetting = allSections["client setting"];
          let sysSettings = allSections["system setting"];

          let checkMissing = !stepsToRepro || !expectedResult || !actualResult || !clientSetting || !sysSettings;

          if(checkMissing) {
            utils.botReply(bot, userID, channelID, "remember to fill in all the required fields! If you're struggling with the syntax, maybe give this tool a try: <https://dabbit.typeform.com/to/mnlaDU>", command, msgID, true);
            return;
          }

          let sysSettingsFlag = sysSettings.match(/(?:\B)(-l|-m|-w|-a|-i)(?:\b)/i);

          if(!!sysSettingsFlag) {
            let whichOS;
            let systemInfo = sysSettingsFlag[1];
                sysSettingsFlag[1] = sysSettingsFlag[1].toLowerCase();

            if(sysSettingsFlag[1] === "-w") {
              whichOS = "windows";
            } else if(sysSettingsFlag[1] === "-i") {
              whichOS = "ios";
            } else if(sysSettingsFlag[1] === "-l") {
              whichOS = "linux";
            } else if(sysSettingsFlag[1] === "-m") {
              whichOS = "macOS";
            } else if(sysSettingsFlag[1] === "-a") {
              whichOS = "android";
            }

            db.get("SELECT " + whichOS + " FROM users WHERE userid = ?", [userID], function(error, dbReplySI) {
              if(!!error) {
                console.log(error);
              }
              if(!dbReplySI || !dbReplySI[whichOS]) {
                utils.botReply(bot, userID, channelID, "you do not have those system settings stored. Please add correct system settings.", command, msgID, true);
                return;
              }
              sysSettings = dbReplySI[whichOS];
              newReportString = newReportString.replace(/(?:\B)(-l|-m|-w|-a|-i)(?:\b)/i, dbReplySI[whichOS]);
              let queueReportString = "\n**Short description:** " + header + "\n**Steps to reproduce:** " + stepsToRepro + "\n**Expected result:** " + expectedResult + "\n**Actual result:** " + actualResult + "\n**Client settings:** " + clientSetting + "\n**System settings:** " + sysSettings;

              queueUtils.queueReport(bot, userTag, userID, channelID, db, msg, newReportString, queueReportString, header);
            });
          } else {
            let queueReportString = "\n**Short description:** " + header + "\n**Steps to reproduce:** " + stepsToRepro + "\n**Expected result:** " + expectedResult + "\n**Actual result:** " + actualResult + "\n**Client settings:** " + clientSetting + "\n**System settings:** " + sysSettings;

            queueUtils.queueReport(bot, userTag, userID, channelID, db, msg, newReportString, queueReportString, header);
          }
        }).catch((errorMessage)=>{
          utils.botReply(bot, userID, channelID, errorMessage, command, msgID, true);
        });

        map.set(userID);
        setTimeout(function() {
          map.delete(userID);
        }, 30000);

        break;
      case "!sumbit":
        utils.botReply(bot, userID, channelID, "did you mean !submit? If so, I took the liberty to fix your command for you! Just copy paste this: `!submit " + joinedMessage + "`", command, msg.id, true);
        break;
    }
  },
  roles: [
    config.roles.everybodyRole
    ],
  channels: [
    config.channels.iosChannel,
    config.channels.canaryChannel,
    config.channels.androidChannel,
    config.channels.linuxChannel
  ],
  acceptFromDM: false
}
module.exports = submitCommand;
