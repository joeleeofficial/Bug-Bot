"use strict";
const config = require("../config");
const utils = require("../src/utils");
const customConfig = require('../configEdit');

function addNoteTrello(bot, channelID, userTag, userID, command, msg, key, note, trello) {
  let addedNote = function(error, info) {
    if(!!error) {
      bot.createMessage(channelID, "Something went wrong, please try again").then(utils.delay(customConfig.delayInS)).then((msgInfo) => {
        bot.deleteMessage(channelID, msgInfo.id).catch(() => {});
      }).catch((err) => {
        console.log("--> addNote | sendNote error\n" + err);
        console.log("addedNote Extra" + error);
      });
    }else{
      utils.botReply(bot, userID, channelID, "you've successfully added your note.", command, msg.id);
      bot.createMessage(config.channels.modLogChannel, "**" + userTag + "**: Added a note to `" + info.data.card.name + "` <http://trello.com/c/" + info.data.card.shortLink + ">").catch((err) => {console.log("modLog addNote success\n" + err);});
    }
  }

  let noteContent = {
    text: note + "\n\n" + userTag
  }
  trello.post("/1/cards/" + key + "/actions/comments", noteContent, addedNote);
}

let addNote = {
  pattern: /!addnote|!note/i,
  execute: function(bot, channelID, userTag, userID, command, msg, trello, db) {
    if(channelID === config.channels.queueChannel) {
      utils.botReply(bot, userID, channelID, "you cannot add notes to queue items.", command, msg.id);
      return;
    }

    let messageSplit = msg.content.split(' ');
    messageSplit.shift();
    let joinedMsg = messageSplit.join(' ');

    let matchContent = joinedMsg.match(/(?:(?:<)?(?:https?:\/\/)?(?:www\.)?trello.com\/c\/)?([^\/|\s|\>]+)(?:\/|\>)?(?:[\w-\d]*)?(?:\/|\>|\/>)?\s*\|\s*([\s\S]*)/i);

    if(!matchContent || !matchContent[1] || !matchContent[2] || matchContent[1] === matchContent[2]) {
      utils.botReply(bot, userID, channelID, "please provide a note & valid queue ID or Trello URL.", command, msg.id);
      return;
    }

    let key = matchContent[1];
    let note = matchContent[2];

    note = utils.cleanText(note, false);

    db.get("SELECT reportStatus, reportMsgID, trelloURL FROM reports WHERE id = " + key + " OR trelloURL = " + key, function(error, reportInfo) {
      if(!!error) {
        console.log("addNote | dbGetErr\n" + error);
      }

      let trelloURL;
      if(!!reportInfo) {
        trelloURL = reportInfo.trelloURL;
      } else {
        trelloURL = key;
      }

      trello.get("/1/cards/" + trelloURL, { }, function(errorURL, urlData) {
        if(!!reportInfo && !!urlData && !!urlData.id && reportInfo.reportStatus === "trello") { // In trello and in Database
          bot.getMessage(channelID, reportInfo.reportMsgID).then((reportMsg) => {
            if(!!reportMsg) {
              let splitMsg = reportMsg.content.split("**Reproducibility:**");
              let editMsgCreate = splitMsg[0] + "**Reproducibility:**\n:pencil: **" + utils.cleanUserTag(userTag) + "**: `" + note + "`" + splitMsg[1];

              bot.editMessage(channelID, reportInfo.reportMsgID, editMsgCreate).catch((err) => {console.log("editMsg Chat Trello\n" + err);});
            }
          }).catch((error) => {console.log("AddNote Trello MsgEdit\n" + error);}); //Trello

          db.run("INSERT INTO reportQueueInfo (id, userID, userTag, info, stance) VALUES (?, ?, ?, ?, ?)", [key, userID, userTag, note, "note"]);
          addNoteTrello(bot, channelID, userTag, userID, command, msg, reportInfo.trelloURL, note, trello);
        } else if(!reportInfo && !!urlData && urlData.closed === false) { // In Trello but not database (legacy reports)
          bot.getMessages(channelID).then((allMsgs) => {
            let reportMsg = allMsgs.find(function(thisMsg) {
              return thisMsg.author.id === config.botID && thisMsg.content.indexOf("https://trello.com/c/" + key) > -1 && thisMsg.content.indexOf("Reproducibility:") > -1;
            });
            if(!!reportMsg) {
              let splitMsg = reportMsg.content.split("**Reproducibility:**");
              let editMsgCreate = splitMsg[0] + "**Reproducibility:**\n:pencil: **" + utils.cleanUserTag(userTag) + "**: `" + note + "`" + splitMsg[1];

              bot.editMessage(channelID, reportMsg.id, editMsgCreate).catch((err) => {console.log("editMsg legacy Chat\n" + err);});
            }
          }).catch((error) => {console.log("AddNote Legacy MsgEdit\n" + error);});

          addNoteTrello(bot, channelID, userTag, userID, command, msg, key, note, trello);
        } else {
          utils.botReply(bot, userID, channelID, "please provide a valid or Trello URL or ID and make sure the report is not closed.", command, msg.id);
          return;
        }
      });
    });
  },
  roles: [
    config.roles.adminRole,
    config.roles.trelloModRole,
    config.roles.devRole,
    config.roles.hunterRole
    ],
  channels: [
    config.channels.iosChannel,
    config.channels.canaryChannel,
    config.channels.androidChannel,
    config.channels.linuxChannel,
    config.channels.queueChannel
  ],
  acceptFromDM: false
}
module.exports = addNote;
