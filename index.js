const Omegle = require('./omegle');
const Discord = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const chalk = require('chalk');
const bot = new Discord.Client();
const om = new Omegle();
const conf = require('./config.json');
const { nanoid } = require('nanoid');
const prefix = conf.prefix;
const channelID = conf.channelID;
const GID = conf.guildID;
const _TOKEN_ = process.env["TOKEN"];
const fs = require('fs');
const _BOT_ADMINS_ = conf.admins;
const _FOOTER_TEXT_ = `Powered by Numachi.live`;
let bannedWordList = conf.bannedWords;
let isModerated = true;
let spyMode = false;
const errorCodes = require('./errorCodes.json');
const _API_URI_ = 'https://api-o.numachi.live' // DONT CHANGE UNLESS YOU KNOW WHAT YOU ARE DOING

// cooldown manager
let cooldowns = {};
cooldowns.start_session = new Set();

let currentChannel = {
    active: false,
    id: '',
    startMsg: '',
    started: false,
    cid: ''
}

function strangerEvent(str){
    if(!currentChannel.active) return;
    console.log(chalk.yellow(`Stranger`) + `[${chalk.red(str ? str : 'Unkown')}]`);
}
function botEvent(str){
    console.log(chalk.yellow(`Bot`) + `[${chalk.red(bot.user.username)}]` + `[${chalk.blueBright(str ? str : 'Unkown')}]`);
}

function messageEvent(stranger = true, message = 'N/A', uid = 'none'){
    console.log(chalk.yellow(`${stranger ? 'Stranger' : 'Bot'}:Message`) + `[${chalk.blueBright(message)}]`);
    addMsgToLog(message, stranger, uid)
}

function indexDatabase(){
    if(!conf.useNumachiWordDB) return botEvent('NotUsingNumachiDB');
    axios.get(_API_URI_ + '/v1/banned-words')  
        .then(function (response) {
            const d = response.data;
            if(d.code !== 200) return botEvent(`NumachiDB:${d.code}:0`);
            for(i of d.json){
                bannedWordList.push(i);
            }
            return botEvent(`NumachiDB:${d.code}:${d.json.length}`)
        })
        .catch(function (error) {
            return botEvent(`NumachiDB:${error}:e`)
        })
}

let chatSession = {};


function addMsgToLog(message = 'N/A', stranger = false, authorId = 'none'){
    if(!chatSession[currentChannel["cid"]]) chatSession[currentChannel["cid"]] = [];

    chatSession[currentChannel["cid"]].push({
        stranger,
        message,
        authorId
    });
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
    if(db.moderated === "false"){ 
        isModerated = false;
    } else {
        isModerated = true;
    }
}

function setValue(key, val, msg){
    const dbJsonStr = fs.readFileSync("./data.json");
    let parsed = JSON.parse(dbJsonStr);
    parsed[key] = val;

    fs.writeFile('./data.json', JSON.stringify(parsed), err => {
        if(err){
            botEvent(`ErrorWritingData`);
            if(msg) msg.reply('Error writing data...');
        } else {
            if(msg) msg.reply('New data set successfully.');
            db = parsed;
            setModerationState();
        }
    });
}


bot.on("message", (msg) => {
    const args = msg.content.split(" ");

    if(msg.channel.id !== channelID) return;
    if(msg.author.bot) return;

    if(args[0] === `${prefix}help`){
        let commands = [
            {
                n: "help",
                desc: "Get help with commands."
            },
            {
                n: "start",
                desc: "Start a session in Omegle!"
            },
            {
                n: "end",
                desc: "End an Omegle session."
            },
            {
                n: "w",
                desc: "Whisper inside of a Omegle session."
            }
        ]

        let mapped = commands.map(i => {
            return (`\`${prefix}${i.n}\` ${i.desc}`)
        });
        const embed = new Discord.MessageEmbed()
            .setTitle(`**Help**`)
            .setDescription(mapped.join("\n"))
            .setTimestamp()
            .setColor('#2F95DC')
            .setFooter(_FOOTER_TEXT_)
        return msg.channel.send(embed);
    } else if(args[0] === `${prefix}indexdb`){
        if(!_BOT_ADMINS_.includes(msg.author.id)) return;

        indexDatabase();
        return msg.reply('Indexed.')
    } else if(args[0] === `${prefix}clearchats`){
        if(!_BOT_ADMINS_.includes(msg.author.id)) return;

        fs.writeFile('./messages.json', JSON.stringify({}), err => {
            if(err){
                return msg.reply('An error has occured.')
            } else {
                return msg.reply('Success.')
            }
        });
    } else if(args[0] === `${prefix}getchat`){
        if(!_BOT_ADMINS_.includes(msg.author.id)) return;
        if(!args[1]) return msg.reply('ID missing.');
        if(!args[2]) return msg.reply('Provide what you want to see. (0-25)');

        const counts = args[2].split("-");
        if(counts.length < 2) return msg.reply('Provide what you want to see. (0-25) <- format');

        if(isNaN(counts[0]) || isNaN(counts[1])) return msg.reply('Valid numbers expected.');

        const sessions = fs.readFileSync('./messages.json', 'utf-8');
        const sessionJson = JSON.parse(sessions);

        if(!sessionJson[args[1]]) return msg.reply("Session ID not found.");

        let messages = sessionJson[args[1]];

        const formatedMsg = messages.slice(counts[0], counts[1]);

        const listItems = formatedMsg.map(i => {
            const iu = bot.users.cache.get(i.authorId);
            return (`${i.stranger ? 'Stranger' : `Bot(${iu.username}#${iu.discriminator}|${iu.id})`}: ${i.message}`)
        });
        
        const msgReady = listItems.join("\n---\n");
        botEvent(`Sending:LogID:${args[1]} ${msg.author.username}#${msg.author.discriminator}`)
        bot.users.cache.get(msg.author.id).send(`**${args[1]} MSG-LOG [${listItems.length}/${messages.length}]**\n\n${msgReady}`)
    } else if(args[0] === `${prefix}setdb`){
        if(!_BOT_ADMINS_.includes(msg.author.id)) return;
        if(!args[1]) return msg.reply('Key missing.');
        if(!args[2]) return msg.reply('Val missing.');

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

        if(cooldowns.start_session.has(msg.guild.id)) return msg.reply(`Yikes, this guild is on a cooldown! Please wait for max ${(conf?.cooldowns?.start_session ? conf?.cooldowns.start_session : 5000) / 1000} seconds.`)

        cooldowns.start_session.add(msg.guild.id);
        setTimeout(() => {
            cooldowns.start_session.delete(msg.guild.id);
        }, conf?.cooldowns?.start_session ? conf?.cooldowns?.start_session : 5000)

        currentChannel.cid = nanoid(14);
        om.connect(args[1] ? tags : [], isModerated);
        const embed = new Discord.MessageEmbed()
            .setTitle(args[1] ? `**Finding Session**` : `**Connecting to Stranger**`)
            .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
            .setColor('#2F95DC')
            .addField('Status', `🟠 Connecting... (Will auto-disconnect in 10 seconds if no stranger is found)`, true)
            .addField('ID', currentChannel.cid)
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
                currentChannel.started = false;
                currentChannel.active = false;
                const embed = new Discord.MessageEmbed()
                    .setTitle(`**No Stranger found...**`)
                    .setDescription(`No stranger was found 😦`)
                    .addField('Status', `🔴 Disconnected`, true)
                    .addField('ID', currentChannel.cid)
                    .addField('Next?', 'Searching for random Stranger...')
                    .setColor('#2F95DC')
                    .setTimestamp()
                    .setFooter(_FOOTER_TEXT_)
            
                try {
                    om.stopLookingForCommonLikes(() => {
                        bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
                        .then(msg=> {
                            msg.edit(embed)
                        })
                    })
                } catch(e){
                    // send new
                    bot.channels.cache.get(channelID).send(embed);
                }
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
        messageEvent(false, message, msg.author.id);
        
        om.send(message);
    }
});

om.on("commonLikes", (likes) => {
    botEvent(`common:${likes}`);
    const embed = new Discord.MessageEmbed()
        .setTitle(`**Connected to Stranger**`)
        .setDescription(`Stop this session by using \`${prefix}end\`\n🤫 whisper to the channel (does not go to stranger) \`${prefix}w\``)
        .addField('Status', `🟢 Connected`, true)
        .addField('ID', currentChannel.cid)
        .addField('Common Interests', likes, true)
        .setColor('#2F95DC')
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
        .then(msg=> {
            msg.edit(embed)
        }).catch(e => {
            let fallbackMsg = `[${currentChannel.cid}] Stranger found with common interests!\n**${likes}**`;
            bot.channels.cache.get(channelID).send(fallbackMsg);
        });
})

bot.on("ready", () => {
    botEvent('ready')
    indexDatabase();

    bot.user.setActivity(conf.status ? conf.status.replace("[PREFIX]", prefix) : 'Powered by Numachi.', { type: 'WATCHING' })
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
    fs.readFile('./messages.json', 'utf-8', (err, jstr) => {
        let existingLog = JSON.parse(jstr);
        existingLog[currentChannel.cid] = chatSession[currentChannel.cid];

        fs.writeFile('./messages.json', JSON.stringify(existingLog), err => {
            if(err){
                botEvent(`ErrorWritingData`);
            } else {
                botEvent('AddedLog')
            }
        });
        chatSession = {};
        currentChannel.cid = '';
    })
})

om.on("antinudeBanned", () => {
    botEvent("antinudeBanned")
    currentChannel.active = false;
    currentChannel.started = false;
    
    const banEmbed = new Discord.MessageEmbed()
        .setTitle(`Banned From Omegle`)
        .setDescription(`The host of this bot was temporarily banned by omegle, entering unmoderated mode!`)
        .setTimestamp()
        .setColor('#ff0d39')
        .setFooter(_FOOTER_TEXT_)

    setValue('moderated', 'false');
    om.connect([], false);

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
                }).catch(e => {
                    bot.channels.cache.get(channelID).send(embed);
                });
        }
    }, 10000);
    
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
        .addField('Status', `🟠 Waiting...`, true)
        .addField('ID', currentChannel.cid)
        .setColor('#2F95DC')
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
        .then(msg=> {
            msg.edit(embed)
        }).catch(e => {
            let fallbackMsg = `[${currentChannel.cid}] Waiting for stranger...`;
            bot.channels.cache.get(channelID).send(fallbackMsg);
        });
})

om.on("recaptchaRequired", (recap) => {
    console.log(recap, 'recap')
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
        .addField('ID', currentChannel.cid)
        .setTimestamp()
        .setFooter(_FOOTER_TEXT_)

    if(!isModerated) embed.addField(`⚠️ Unmoderated`, `You are currently on the unmoderated version of omegle!`)

    //? Some weird bug, fix this later...
    
    // bot.channels.cache.get(channelID).messages.fetch(currentChannel.startMsg)
    //     .then(msg=> {
    //         console.log(msg.id, 'aaaaa')
    //         try {
    //             msg.edit(embed)
    //         } catch(e){
    //             console.log(e)
    //         }
    //     }).catch(e => {
    //         bot.channels.cache.get(channelID).send(embed);
    //     });

    //? Fallback code
    bot.channels.cache.get(channelID).send(`${ isModerated ? '' : '`⚠️ UNMODERATED`' } **Connected to stranger! [${currentChannel.cid}]**\n\n**Guidelines**\n${conf.guidelines}`)

    currentChannel.started = true;
    currentChannel.active = true;
});

om.on('gotMessage',function(strangerMsg){
    let msg = strangerMsg;
    if(msg.length > 1020) msg = msg.substr(0, 1020);
    
    for(w of bannedWordList){
        if(msg.toLowerCase().includes(w.toLowerCase())){
            const errorStrings = errorCodes.x['0273'];
            const clientString = errorStrings.client.replace("[REJECTED-WORD]", w);
            const strangerString = errorStrings.stranger.replace("[REJECTED-WORD]", w);

            botEvent(`Banned word detected, rejecting Stranger. (${w})`);
            messageEvent(true, `BANNED:` + msg);

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
        messageEvent(true, msg);
        const embed = new Discord.MessageEmbed()
            .setTitle(`Stranger`)
            .setDescription(msg)
            .setTimestamp()
            .setColor('#2F95DC')
            .setFooter(_FOOTER_TEXT_)
    
        bot.channels.cache.get(channelID).send(embed);
    } catch(e){
        messageEvent(true, msg);
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