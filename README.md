# stranger-bot
Omegle <--> Discord


## Docs

`.env`, view the file and fill in your discord bot token
`data.json`, this is where the bot stores it's data (Not recommended touching this).
`errorCodes.json`, this file contains strings for errors.
`config.json` this file contains the other config elements, view the following:
- prefix: This is the bot prefix (!start) in this case it's !.
- status: Use keyword [PREFIX] for the bot prefix.
- channelID: This is the channel the bot will be restricted to, and all messages from strangers will go here.
- admins: These users will be able to alter the `data.json` file, grant this with caution.
- bannedWords: These words are banned, if the strangers says this then the bot will Auto-Disconnect.
- useNumachiWordDB: This will get known words that are banned from our database.


### Notice
Usage of this code/bot is at your own risk, Numachi.live will not be held responsible for any damage or bans.
