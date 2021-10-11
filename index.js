const Omegle = require('./omegle');
const Discord = require('discord.js');
require('dotenv').config();
const chalk = require('chalk');
const bot = new Discord.Client();
const om = new Omegle();
const conf = require('./config.json');
const prefix = conf.prefix;
const channelID = conf.channelID;
const GID = conf.guildID;
const _TOKEN_ = process.env["TOKEN"];
const fs = require('fs');
const _BOT_ADMINS_ = conf.admins;
const _FOOTER_TEXT_ = `Powered by Numachi`;
let bannedWordList = conf.bannedWords;
let isModerated = true;
let spyMode = false;
const errorCodes = require('./errorCodes.json');

function strangerEvent(str){
    console.log(chalk.yellow(`Stranger`) + `[${chalk.red(str ? str : 'Unkown')}]`);
}
function botEvent(str){
    console.log(chalk.yellow(`BOT`) + `[${chalk.red(bot.user.username)}]` + `[${chalk.blueBright(str ? str : 'Unkown')}]`);
}

let db = {};

fs.readFile('./data.json', "utf-8", (err, jsonStr) => {
    if(err){
        botEvent(`ErrorReadingData`);
    }
    db = JSON.parse(jsonStr)
    setModerationState();
});

function setModerationState(){
    if(db.moderated === "false") isModerated = false;
}

function setValue(key, val, msg){
    const dbJsonStr = fs.readFileSync("./data.json");
    let parsed = JSON.parse(dbJsonStr);
    parsed[key] = val;

    fs.writeFile('./data.json', JSON.stringify(parsed), err => {
        if(err){
            botEvent(`ErrorWritingData`);
            msg.reply('Error writing data...');
        } else {
            msg.reply('New data set successfully.');
            db = parsed;
            setModerationState();
        }
    });
}

let currentChannel = {
    active: false,
    id: '',
    startMsg: '',
    started: false
}


bot.on("message", (msg) => {
    const args = msg.content.split(" ");

    if(msg.channel.id !== channelID) return;
    if(msg.author.bot) return;

    if(args[0] === `${prefix}setdb`){
        if(!_BOT_ADMINS_.includes(msg.author.id)) return;
        if(!args[1]) return msg.reply('args[1] missing.');
        if(!args[2]) return msg.reply('args[2] missing.');

        setValue(args[1], args[2], msg)
    } else if(args[0] === `${prefix}w`){
        if(!currentChannel.active) return msg.reply(`No session active... Start one with \`${prefix}start\``);
        msg.react('🤫');
    } else if(args[0] === `${prefix}start`){
        if(currentChannel.active) return msg.reply("A session is already active.");
        let tags = args;
        if(args[1]){
            delete tags[0];
        }

        om.connect(args[1] ? tags : [], isModerated);
        const embed = new Discord.MessageEmbed()
            .setTitle(args[1] ? `**Finding Session**` : `**Connected to Stranger**`)
            .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
            .setColor('#2F95DC')
            .addField('Status', `🟠 Connecting... (Will auto-disconnect in 10 seconds if no stranger is found)`, true)
            .setTimestamp()
            .setFooter(_FOOTER_TEXT_)

        if(!isModerated) embed.addField(`⚠️ Unmoderated`, `You are currently on the unmoderated version of omegle!`)

        msg.reply(embed)
            .then(d => {
                currentChannel.startMsg = d.id;
            })


        setTimeout(() => {
            if(!currentChannel.started){
                botEvent('Timeout:10s:Disconnect');
                om.disconnect();
                currentChannel.started = false;
                currentChannel.active = false;
                const embed = new Discord.MessageEmbed()
                    .setTitle(`**No Stranger found...**`)
                    .setDescription(`No stranger was found 😦`)
                    .addField('Status', `🔴 Disconnected`, true)
                    .setColor('#2F95DC')
                    .setTimestamp()
                    .setFooter(_FOOTER_TEXT_)
            
                bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
                    .then(msg=> {
                        msg.edit(embed)
                    })
            }
        }, 10000);
        currentChannel.active = true;
    } else if(args[0] === `${prefix}end`){
        if(!currentChannel.active) return msg.reply("No session to end.");
        om.disconnect()
        const embed = new Discord.MessageEmbed()
            .setTitle(`Disconnected...`)
            .setDescription(`Start a new session with \`${prefix}start\``)
            .setTimestamp()
            .setColor('#ff0d39')
            .setFooter(_FOOTER_TEXT_)

        bot.channels.cache.get(channelID).send(embed);
        currentChannel.started = false;
        currentChannel.active = false;
    } else if(currentChannel.active){
        if(!currentChannel.started) return;
        let message = args;
        if(!message[0]) return msg.reply("Cannot send an empty message.");

        message = message.join(" ");
        om.send(message);
    }
});

om.on("commonLikes", (likes) => {
    botEvent(`common:${likes}`);
    const embed = new Discord.MessageEmbed()
        .setTitle(`**Connected to Stranger**`)
        .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
        .addField('Status', `🟢 Connected`, true)
        .addField('Common Interests', likes, true)
        .setColor('#2F95DC')
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
        .then(msg=> {
            msg.edit(embed)
        })
})

bot.on("ready", () => {
    botEvent('ready')

    bot.user.setActivity('Powered by Numachi');
    bot.user.setActivity('Omegle', { type: 'WATCHING' })
})

om.on("typing", () => {
    strangerEvent('typing');
    bot.guilds.cache.get(GID).channels.cache.get(channelID).startTyping()
})

om.on("stoppedTyping", () => {
    strangerEvent('stoppedTyping');
    bot.guilds.cache.get(GID).channels.cache.get(channelID).stopTyping()
});

om.on("disconnected", () => {
    botEvent('disconnected')
    bot.guilds.cache.get(GID).channels.cache.get(channelID).stopTyping()
})

om.on("antinudeBanned", () => {
    botEvent("antinudeBanned")
    currentChannel.active = false;
    currentChannel.started = false;
    
    const banEmbed = new Discord.MessageEmbed()
        .setTitle(`Banned From Omegle`)
        .setDescription(`The host of this bot was temporarily banned by omegle, please be patient!`)
        .setTimestamp()
        .setColor('#ff0d39')
        .setFooter(_FOOTER_TEXT_)

    return bot.channels.cache.get(channelID).send(banEmbed);
});

om.on('omerror',function(err){
	botEvent(`omerror[${err}]`)

    let ErrorString = {
        "send(): null": "Provided Message not supported/allowed.",
        "send(): Not connected to the server.": "Please wait, connecting to server...",
        "send(): Not connected to a stranger yet.": "Connecting to stranger, please wait.",
        "disconnect(): Couldn't send the disconnect event. Not connected to the server.": "Server Disconnected."
    }

    let endMsg = err;
    if(ErrorString[err]) endMsg = ErrorString[err];

    const embed = new Discord.MessageEmbed()
        .setTitle(`Omegle`)
        .setDescription(endMsg + '\n\n' + currentChannel.id)
        .setTimestamp()
        .setColor('#ff0d39')
        .setFooter(_FOOTER_TEXT_)

    bot.channels.cache.get(channelID).send(embed);
});

om.on("waiting", () => {
    botEvent('waiting')
    const embed = new Discord.MessageEmbed()
        .setTitle(`**Finding Stranger**`)
        .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
        .addField('Status', `🟠 Waiting`, true)
        .setColor('#2F95DC')
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
        .then(msg=> {
            msg.edit(embed)
        })
})

om.on("recaptchaRequired", (recap) => {
    console.log(recap)
})

om.on('gotID',function(id){
    if(id === undefined){
        botEvent('Error connecting to server')
        bot.channels.cache.get(channelID).send("Connection failed, please try again.");
        currentChannel.started = false;
        return currentChannel.active = false;
    }
	botEvent('Connected:' + id)
    currentChannel.id = id;
});

om.on('waiting', function(){
	strangerEvent('waiting')
});

om.on('connected',function(){
	botEvent('connected');

    
    const embed = new Discord.MessageEmbed()
        .setTitle(`**Connected to Stranger**`)
        .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
        .setColor('#2F95DC')
        .addField('Status', `🟢 Connected`, true)
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    if(!isModerated) embed.addField(`⚠️ Unmoderated`, `You are currently on the unmoderated version of omegle!`)

    bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
        .then(msg=> {
            msg.edit(embed)
        })

    currentChannel.started = true;
    currentChannel.active = true;
});

om.on('gotMessage',function(msg){
    for(w of bannedWordList){
        if(msg.toLowerCase().includes(w.toLowerCase())){
            const errorStrings = errorCodes.x['0273'];
            const clientString = errorStrings.client.replace("[REJECTED-WORD]", w);
            const strangerString = errorStrings.stranger.replace("[REJECTED-WORD]", w);

            botEvent(`Banned word detected, rejecting Stranger. (${w})`);
            om.send(strangerString + '\nhttps://hc.numachi.live/t/forced-disconnection-x0273/25');

            om.disconnect();
            currentChannel.active = false;
            currentChannel.started = false;

            const banEmbed = new Discord.MessageEmbed()
                .setTitle(`Forced Disconnection`)
                .setDescription(clientString + '\nhttps://hc.numachi.live/t/forced-disconnection-x0273/25')
                .addField(`Stranger Sentence`, msg, true)
                .setTimestamp()
                .setColor('#ff0d39')
                .setFooter(_FOOTER_TEXT_)
        
            return bot.channels.cache.get(channelID).send(banEmbed);
        }
    }

    try {
        strangerEvent(msg ? msg : 'No Message');
        const embed = new Discord.MessageEmbed()
            .setTitle(`Stranger`)
            .setDescription(msg)
            .setTimestamp()
            .setColor('#2F95DC')
            .setFooter(_FOOTER_TEXT_)
    
        bot.channels.cache.get(channelID).send(embed);
    } catch(e){
        strangerEvent('No Message');
        const embed = new Discord.MessageEmbed()
            .setTitle(`Stranger [Invalid Message]`)
            .setDescription(`Message from Stranger was invalid...`)
            .setTimestamp()
            .setColor('#2F95DC')
            .setFooter(_FOOTER_TEXT_)
    
        bot.channels.cache.get(channelID).send(embed);
    }
});

om.on('strangerDisconnected',function(){
    strangerEvent('strangerDisconnected')
    bot.channels.cache.get(channelID).send('**The stranger has disconnected...**');
    currentChannel.started = false;
    currentChannel.active = false;
});

bot.login(_TOKEN_);