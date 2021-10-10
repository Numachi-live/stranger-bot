const Omegle = require('omegle-node-fix');
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
const _BOT_ADMINS_ = conf.admins
const _FOOTER_TEXT_ = `Powered by Numachi`;
let bannedWordList = conf.bannedWords;

let currentChannel = {
    active: false,
    id: '',
    startMsg: ''
}

function strangerEvent(str){
    console.log(chalk.yellow(`Stranger`) + `[${chalk.red(str ? str : 'Unkown')}]`);
}
function botEvent(str){
    console.log(chalk.yellow(`BOT`) + `[${chalk.red(bot.user.username)}]` + `[${chalk.blueBright(str ? str : 'Unkown')}]`);
}

function restartBot(channel) {
    channel.send('Restarting')
        .then(msg => bot.destroy())
        .then(() => bot.login(_TOKEN_));
}

bot.on("message", (msg) => {
    const args = msg.content.split(" ");

    if(msg.channel.id !== channelID) return;
    if(msg.author.bot) return;
    if(args[0] === `${prefix}w`){
        if(!currentChannel.active) return msg.reply(`No session active... Start one with \`${prefix}start\``);
        msg.react('🤫');
    } else if(args[0] === `${prefix}start`){
        if(currentChannel.active) return msg.reply("A session is already active.");
        let tags = args;
        if(args[1]){
            delete tags[0];
        }

        om.connect(args[1] ? tags : []);
        const embed = new Discord.MessageEmbed()
            .setTitle(args[1] ? `**New Session**` : `**Connected to Stranger**`)
            .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
            .setColor('#2F95DC')
            .addField('Status', args[1] ? `🔴 Connecting...` : `🟢 Connected`, true)
            .setTimestamp()
            .setFooter(_FOOTER_TEXT_)

        msg.reply(embed)
            .then(d => {
                currentChannel.startMsg = d.id;
            })

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
        currentChannel.active = false;
    } else if(currentChannel.active){
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
});

om.on('omerror',function(err){
	botEvent(`omerror[${err}]`)

    let ErrorString = {
        'send(): null': "Provided Message not supported/allowed.",
        'send(): Not connected to a stranger yet.': "Not connected to stranger completely..."
    }

    let endMsg = err;
    if(ErrorString[err.toLowerCase()]) endMsg = ErrorString[err.toLowerCase()];

    const embed = new Discord.MessageEmbed()
        .setTitle(`Omegle Error`)
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
});

om.on('gotMessage',function(msg){
    for(w of bannedWordList){
        if(msg.toLowerCase().includes(w.toLowerCase())){
            botEvent(`Banned word detected, rejecting Stranger. (${w})`);
            om.disconnect();
            currentChannel.active = false;
    
            const banEmbed = new Discord.MessageEmbed()
                .setTitle(`Forced Disconnection`)
                .setDescription(`A banned word was triggered: **${w}**. Stranger rejected.`)
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
            .setDescription(`No Message.`)
            .setTimestamp()
            .setColor('#2F95DC')
            .setFooter(_FOOTER_TEXT_)
    
        bot.channels.cache.get(channelID).send(embed);
    }
});

om.on('strangerDisconnected',function(){
    strangerEvent('strangerDisconnected')
    bot.channels.cache.get(channelID).send('**The stranger has disconnected...**');
    currentChannel.active = false;
});

bot.login(_TOKEN_);
