"use strict";
const config = require("../config");
const utils = require("./utils");
const customConfig = require("../configEdit");

function attachUtils (bot, channelID, userTag, userID, command, msg, trello, trelloURL, attachment, removeMsg, urlDataName, reportMsgID) {
  let attachmentAttached = function(error, dataAttach) {
    if(!!error) {
      utils.botReply(bot, userID, config.channels.modLogChannel, "Something went wrong by attaching, please notify the authorities <https://trello.com/c/" + trelloURL + ">.", command, null, false);
    }

    if(removeMsg === true) {
      bot.getMessages(channelID).then((messages) => {
        let gotMsg = messages.find(function(msgs) {
          return msgs.author.id === config.botID && msgs.content.indexOf("https://trello.com/c/" + trelloURL) > -1 && msgs.content.indexOf("Reproducibility:") > -1;
        });

        if(!!gotMsg) {
          let newMsg = gotMsg.content + "\n:paperclip: **" + utils.cleanUserTag(userTag) + "** | " + attachment;
          bot.editMessage(config.channels.queueChannel, reportMsgID, newMsg).catch((err) => {console.log("attachUtils | editQueueMsg\n" + err);});
          bot.editMessage(channelID, gotMsg.id, newMsg).catch((err) => {console.log("attachUtils | editMsg\n" + err);});
        }
        setTimeout(function() {
          bot.deleteMessage(channelID, msg.id).catch(() => {});
        }, customConfig.delayInS * 800);
      }).catch(error => {console.log("attachUtils getMSG\n" + error);});
    }
    bot.createMessage(config.channels.modLogChannel, ":paperclip: **" + utils.cleanUserTag(userTag) + "**: `" + urlDataName + "` <https://trello.com/c/" + trelloURL + ">");
  }

  let addAttachment = {
    url: attachment,
    name: userTag
  }
  trello.post('/1/cards/' + trelloURL + '/attachments', addAttachment, attachmentAttached);
}

module.exports = attachUtils;
