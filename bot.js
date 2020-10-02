//Modules required
var mysql = require('mysql');
const MySQLEvents = require('@rodrigogs/mysql-events');
const Discord = require("discord.js");
var os = require('os'); //Built in library to gather system data.
const fs = require("fs");
var express = require("express");
var Rcon = require('rcon');
const TelegramBot = require('node-telegram-bot-api');
const pm2 = require('@pm2/io')

const tgMsgCnt = pm2.counter({
	name: 'Telegram Messages',
	id: 'app/realtime/requests'
})
const dcMsgCnt = pm2.counter({
	name: 'Discord Messages',
	id: 'app/realtime/requests'
})
const token = 'rEDACTION'; //Telegram stuff
const tgBot = new TelegramBot(token, {polling: true});

var mc = new Rcon('MCServer IP', 25575, 'RConPassword'); //Connect to our Minecraft server for the KaiMC shop
const client = new Discord.Client(); //Make a new Discord bot session
client.login('REDACTED'); //Secret login key. OvO.
let botReady = false;
//Economy modules
 //We will begin using our own DB system for economy
var db = mysql.createConnection({
	host: "rEDACTION",
	user: "Kaivax",
	password: "rEDACTION"
});
db.connect(function(err) {
	if (err) {
		logger('NexiumDB','Database failure.',"INFO");
	}
	logger("Discord","Connected to NexiumDB.","INFO");
});

//API for serving and receiving commands from other systems
var app = express();
app.listen(3000, () => {
	logger("KaiAPI",'API running on port 3000. Waiting for I/O...',"INFO");
});
const settings = {
  prefix: 'k!' //All if-else statements beginning with command == will use this to begin commands on Discord. k!<command> <arg1> <arg2> etc...
}

const ownerID = ('612376517686853653'); //Owner Discord ID
const kaivaxID = ('630956769786462218'); //ID of bot

logger("Core System",'Configuration set successfully. Attempting to start Kaivax...',"INFO"); //Announce that there were no issues on startup configuration

//Statistics
	//Messages
	var msgSent_session = 0;
	var msgReciv_session = 0;
	var kaiStatus = 'none';
	var kaiAPI_ver = 'v2.1_BETA';
	var lastMsg;
	//WebUI > Discord
	var msgAnnounce;
	var msgAnnounceID;


mc.on('auth', function() {
	logger("RCON-MC","Connected to DWXE Minecraft Server!","INFO");
});
mc.connect();

const awooRecently = new Set();
const robRecently = new Set();
const diceRecently = new Set();
//Discord API settings
client.on("ready", () => {
  logger("Discord",`Kaivax is now online and running! Waiting for input...`,"INFO"); //Announce we have connected to the Discord API and we are ready to handle requests.
  kaiStat();
});
botReady = true;
let dbUpdated = false;
let dbUpdateType = 'none';
let newProfile = 'none';
//Database monitoring
const dbmon = async () => {
	const instance = new MySQLEvents(db, {
		startAtEnd: true,
		serverId: 32
	});
	await instance.start();
	//These are to listen to certain schemas and tables, i.e. monitor Praxis posts.
	instance.addTrigger({
		name: 'raveninsert',
		expression: 'kaivax.raven',
		statement: MySQLEvents.STATEMENTS.INSERT,
		onEvent: e => {
			console.log(e);
			dbUpdated = true;
			dbUpdateType = 'add';
		}
	});
	instance.addTrigger({
		name: 'ravenremove',
		expression: 'kaivax.raven',
		statement: MySQLEvents.STATEMENTS.DELETE,
		onEvent: e => {
			console.log(e);
			dbUpdated = true;
			dbUpdateType = 'rm';
		}
	});
	instance.addTrigger({
		name: 'praxisposted',
		expression: 'praxissocial.posts',
		statement: MySQLEvents.STATEMENTS.INSERT,
		onEvent: e => {
			console.log(e);
			dbUpdated = true;
			dbUpdateType = 'padd';
		}
	});
	instance.addTrigger({
		name: 'newSabreSSO',
		expression: 'sabre_accts.sabresso',
		statement: MySQLEvents.STATEMENTS.INSERT,
		onEvent: e => {
			console.log(e);
			newProfile = true
		}
	});
	instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
	instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};
dbmon();
//Discord messaging.
client.on('message', async msg => {
	logMsgs(msg.author.id,msg.author.username,msg.content,currentTime());
	setInterval(checkIO,500);
	setInterval(profileUpdate,5000);
	setInterval(doUpdate,5000);

	function checkIO() {
		if(msgAnnounce !== undefined) {
			kaiStat('Received KaiAPI request.')
			client.channels.get(msgAnnounceID).send(msgAnnounce,{ split: true });
			msgAnnounce = undefined;
		}
	}

	function profileUpdate() {
		if(newProfile === true) {
		const dbEmbed = {
			color: 65535,
			title: 'SabreSSO',
			url: 'https://dwxenterprises.net/',
			description: 'A new user was created!',
			timestamp: new Date(),
			footer: {
				text: 'Powered by Kaivax, the DWXE bot',
			},
		};
		client.channels.get('693353645923631154').send({ embed: dbEmbed });
		newProfile = false;
		}
	}

	function doUpdate() {
		if(dbUpdated === true) {
			if(dbUpdateType === 'padd') {
				const dbEmbed = {
					color: 14993408,
					title: 'Praxis Social Network',
					url: 'https://raven.dwxenterprises.net/',
					description: 'Theres a new Praxis post!',
					timestamp: new Date(),
					footer: {
						text: 'Powered by Kaivax, the DWXE bot',
					},
				};
				client.channels.get('693353645923631154').send({ embed: dbEmbed });
				dbUpdated = false;
			}

			if(dbUpdateType === 'add') {
				const dbEmbed = {
					color: 3066993,
					title: 'Ravenlog Updated',
					url: 'https://raven.dwxenterprises.net/',
					description: 'A new log was added to Raven',
					timestamp: new Date(),
					footer: {
						text: 'Powered by Kaivax, the DWXE bot',
					},
				};
				client.channels.get('705336893717348374').send({ embed: dbEmbed });
				dbUpdated = false;
			}

			if(dbUpdateType === 'rm') {
				const dbEmbed = {
					color: 16711680,
					title: 'Ravenlog Updated',
					url: 'https://raven.dwxenterprises.net/',
					description: 'A log was removed from Raven',
					timestamp: new Date(),
					footer: {
						text: 'Powered by Kaivax, the DWXE bot',
					},
				};
				client.channels.get('705336893717348374').send({ embed: dbEmbed });
				dbUpdated = false;
			}
		}

	}

		kaiStat();
		lastMsg = msg.author.username + ' (' + msg.author.id + ') ' + msg.content;
		logger("Discord",'Recieved Message: ' + msg,'INFO'); //Log all messages to the console. Dont spam #logs.
		dcMsgCnt.inc();
		if (msg.author.id !== kaivaxID) {
			msgReciv_session = msgReciv_session + 1; //Add 1 to each recieved message for every user who sends a message (that isnt our bot)
		}
		if (msg.author.id === kaivaxID) {
			msgSent_session = msgSent_session + 1;//Add 1 to each sent message for every message our bot sends.
		}
		//Reactions to messages and message content
        if (msg.author.bot) return; //We dont care to react and interact with other bots. Ignore them.			
    	//kaibuxAdd(msg.author.id,1);
        if (msg.isMentioned(ownerID) && msg.author.id !== kaivaxID) {
            logger("Discord",'Owner was mentioned', 'INFO');
            msg.react('😡'); //React and log that someone has mentioned the bot owner, and it wasnt this bot.
        }
        if (msg.content.toLowerCase().includes('yeehaw')) {
            msg.react('🤠'); //React to a message that includes "yeehaw" anywhere in the message
        }
		var command = msg.content.toLowerCase().slice(settings.prefix.length).split(' ')[0];
		var args = msg.content.split(' ').slice(1);
		//Raven Logging System
		if (command === 'rlog') {
				kaiStat('IN SESSION-RavenLog');
				msg.channel.send('Hello. Would you like to create a NEW log or LIST logs?');
				logger("Discord","RLOG SESSION BEGIN","WARN");

				const collector = new Discord.MessageCollector(msg.channel, m => m.author.id === msg.author.id, { time: 10000 });
				collector.on('collect', msg => {
					//Create a new log
					if (msg.content.toLowerCase() === 'new') {
						if (msg.author.id === ownerID) {
							msg.channel.send('[CREATE] Your log has started. When you are finished, please end the session using RLOG.end');
							var logContent = ' ';
							var logName = 'RAVENLOG-DISCORD_' + currentTime();
							const collector = new Discord.MessageCollector(msg.channel, m => m.author.id === msg.author.id, {time: 240000});
							kaiStat('Waiting for completion of RavenLog...');
							collector.on('collect', msg => {
								if (msg.content.toLowerCase() !== 'rlog.end') {
									logContent = logContent + ' ' + msg.content;
								}
								if (msg.content.toLowerCase() === 'rlog.end') {
									msg.channel.send('[CREATE] Received data. What is the current status of this log?');
									const collector = new Discord.MessageCollector(msg.channel, m => m.author.id === msg.author.id, {time: 10000});
									collector.on('collect', msg => {
										if (msg.content) {
											var logStatus = msg.content;
											msg.channel.send('[CREATE] Log finished. Your log ID is: ' + logName + ' . Have a nice day.');
											ravenlog(logName, 'CREATE', logContent, logStatus);
											kaiStat('Created new RavenLog: ' + logName);
										}
									})
								}
							})
						} else {
							logger("Discord","An unauthorized user has attempted to access/modify Raven Logging. Ignored.", "WARN");
							msg.channel.send('Unauthorized.')
						}
					}
					//List logs
					if (msg.content.toLowerCase() === 'list') {
							msg.channel.send('Last log entered.');
							db.query("SELECT * FROM kaivax.raven ORDER BY logname ASC;", function (err,result,fields) {
								if (err) {
									logger("Discord",'Could not display content!',"WARN")
								}
								var row1 = JSON.parse(JSON.stringify(result[0]));
								msg.channel.send('**Log ID:** ' + row1.logname);
								msg.channel.send('**Status:** ' + row1.status);
								msg.channel.send('**Content:** ' + row1.content,{ split: true });
					})
					}
				})
		}
		//Management commands.
		if (command === 'guildstats') {
			getGuildStats(); //Retrieve and process stats
			msg.reply('Total messages(RX/TX): ' + msgTotal_session + '. Recieved messages: ' + msgReciv_session + '. Sent messages: ' + msgSent_session);
			msg.reply('This means that every user has an average of ' + msgAvg_session + ' messages total (Since my last bootup).'); //And then lets organize our stats for humans to read.
			kaiStat('Sent some guild stats.');
		}

		if (command === 'diagnostic') {
			msg.reply(getSystemStats() + getGuildStats() );
			kaiStat('Ran diagnostic.');
		}

		//Economy features
		if (command === 'awoo') {
			kaiStat('Awoo!');
			if (awooRecently.has(msg.author.id)) {
				msg.channel.send("Wait a bit before awooing again... - " + msg.author);
			} else {
				var randInt = randomInt(1,20);
				msg.reply('Awooo! ' + randInt + ' has been added to your account. ');
				kaibux(msg.author.id, randInt);
				logger("Discord",msg.author.id + ' used k!awoo. Added balance: ' + randInt,'INFO');
				awooRecently.add(msg.author.id);
				db.query('INSERT INTO sabre_accts.transactions (`from`,`to`,`amount`,`timestamp`) VALUES ("kaivax","'+msg.author.username+'",'+randInt+',"'+currentTime()+'");', function(err,rows,fields) { //Updates bank info instead of replacing (which may cause errors due to SQL Primary Keys)
					if(err) throw err;
					logger("Discord",'Updated transaction table',"INFO");
				});
				setTimeout(() => {
					awooRecently.delete(msg.author.id);
				}, 14400000); //4 hours
			}
		}
	if (command === 'rob') {
		var user = msg.mentions.users.first().id;
		if (robRecently.has(msg.author.id)) {
			msg.channel.send("Wait a bit before robbing another user of their hopes and dreams - " + msg.author);
		}
		else {
			var robAmt;
			var robAUserRep;
			var robBUserRep;
			if(user === '630956769786462218' || user == '612376517686853653') {
				db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
					var Cuser = Math.abs(rows[0].kaibuxCredits) - 10;
					db.query('REPLACE INTO sabre_accts.sabresso SET kaibuxCredits="' + Cuser + '";', function (err, rows, fields) {
						if (err) throw err;
					});
				});
				msg.reply('You failed to rob ' + msg.mentions.users.first() + '! 10 Kaibux has been taken from your account.');
			}
			else {
			var success = randomInt(1, 100);
			if (success > 50) { //Yes
				db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.mentions.users.first().id, function (err, rows, fields) {
					var robMax;
					if(Math.abs(rows[0].kaibuxCredits) > 200) {
						robMax = 200;
					}
					else {
						robMax = Math.abs(rows[0].kaibuxCredits);
					}
					robAmt = randomInt(0, robMax);
				});
				db.query('SELECT username FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.mentions.users.first().id, function (err, rows, fields) {
					robBUserRep = rows[0].username;
				});
				db.query('SELECT username FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
					robAUserRep = rows[0].username;
				});
				var Auser;
				var Buser; // Auser >> Buser || Auser - amount > Buser + amount
				//Remove amount from user A
				db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
					Auser = Math.abs(rows[0].kaibuxCredits) + Math.abs(robAmt);
					db.query('REPLACE INTO sabre_accts.sabresso SET discordLinkID = ' + msg.author.id + ', kaibuxCredits=' + Auser + ',username="' + robAUserRep + '";', function (err, rows, fields) {
						if (err) throw err;
					});
				});
				//Add amount to user B
				db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.mentions.users.first().id, function (err, rows, fields) {
					Buser = Math.abs(rows[0].kaibuxCredits) - Math.abs(robAmt);
					logger("Discord",'Taking away ' + robAmt + ' for user ' + msg.mentions.users.first().id + ' from ' + rows[0].kaibuxCredits + ' to amount ' + Buser, "WARN")
					msg.channel.send(msg.author + ' has robbed ' + msg.mentions.users.first() + ' of ' + robAmt + ' of their Kaibux! Oh boy.');
					db.query('REPLACE INTO sabre_accts.sabresso SET discordLinkID = ' + msg.mentions.users.first().id + ', kaibuxCredits=' + Buser + ',username="' + robBUserRep + '";', function (err, rows, fields) {
						if (err) throw err;
					});
				});
			}
			if (success < 50) { //No
					db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
						var Cuser = Math.abs(rows[0].kaibuxCredits) - 10;
						db.query('REPLACE INTO sabre_accts.sabresso SET discordLinkID = ' + msg.author.id + ', kaibuxCredits=' + Cuser + ',username="' + robAUserRep + '";', function (err, rows, fields) {
							if (err) throw err;
						});
					});
					msg.reply('You failed to rob ' + msg.mentions.users.first() + '! 10 Kaibux has been taken from your account.');
			}
			}
				robRecently.add(msg.author.id);
				setTimeout(() => {
					robRecently.delete(msg.author.id);
				}, 14400000); //4 hours
			}
		}

		if (command == 'rolldice') {
			if (diceRecently.has(msg.author.id)) {
				msg.channel.send("Wait a bit before rolling some more dice. - " + msg.author);
			} else {
				kaiStat('Rolling dice for user: ' + msg.author.username);
				logger("Discord",' k!rolldice was issued. Processing!', 'INFO'); //Issues arised here when we wanted to "roll" some dice, so logger commands are more frequent here.
				var roll1 = randomInt(1, 6);
				logger("Discord",' Roll 1: ' + roll1, 'INFO');
				var roll2 = randomInt(1, 6);
				logger("Discord",' Roll 2: ' + roll2, 'INFO');
				if (roll1 && roll2 == 1) { //If both virtual dice rolled 1, then its snake eyes (or it would look like snake eyes on real dice).
					msg.reply('Snake Eyes! You lost 100 KaiBux');
					kaibux(msg.author.id, -100); //Because the user rolled Snake Eyes, lets take away 100 KaiBux
					logger("Discord",msg.author.id + ' has gotten Snake Eyes on their dice roll! They lost 100 KaiBux. ', 'WARN');
				}
				if (roll1 && roll2 == 6) { //If both dice rolled 6, then lets give them 200 KaiBux
					msg.reply('Jackpot! You won 200 Kaibux');
					kaibux(msg.author.id, 200);
					logger("Discord",msg.author.id + ' has gotten a Jackpot on their dice roll! They won 200 KaiBux. ', 'WARN');
					//Update transaction logs
					db.query('INSERT INTO sabre_accts.transactions (`from`,`to`,`amount`,`timestamp`) VALUES ("'+msg.author.username+'","'+user.username+'",'+amount+',"'+currentTime()+'");', function(err,rows,fields) { //Updates bank info instead of replacing (which may cause errors due to SQL Primary Keys)
						if(err) throw err;
						logger("Discord",'Updated transaction table',"INFO");
					});
				}
				if (roll1 == roll2) { //If they rolled the same amount on both dice, lets roll another die and double the value that die gets.
					msg.reply('Doubles! Lets roll 1 more die and the amount you roll will be doubled!');
					var r3 = randomInt(1, 6);
					r3 = r3 * 2;
					msg.reply('You rolled: ' + r3 / 2 + ' which resulted in a double of ' + r3); //Show them what we rolled, and what it is when doubled.
					kaibux(msg.author.id, r3);
					logger("Discord",msg.author.id + ' has gotten ' + r3 + ' added to their account (Doubles).', 'WARN');
				} else { //If no "special" rolls were encountered, then add up the sum of both die and add that value to the users balance
					var rollSum = roll1 + roll2;
					msg.reply('You rolled ' + roll1 + ' and a ' + roll2 + ' which adds up to a total of ' + rollSum + ' . The sum has been added to your account.');
					kaibux(msg.author.id, rollSum);
					logger("Discord",msg.author.id + ' has gotten ' + rollSum + ' added to their account.', 'WARN');
				}
				logger("Discord",'Dice roll complete.', 'INFO');
				diceRecently.add(msg.author.id);
				setTimeout(() => {
					diceRecently.delete(msg.author.id);
				}, 14400000);
			}
		}

		if (command === 'balance') {
			logger("Discord",msg.author.id + 'requested their balance.', 'INFO'); //Send some alerts to log console.
			db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
				if(err) {
					msg.reply('You do not have an account. Please run k!awoo to get your first Kaibux.');
				}
				msg.channel.send(msg.author.username + ' currently has ' + rows[0].kaibuxCredits + ' KaiBux.'); //And read it out to them in the message
			});
		}

		if (command === 'setbalance' || command === 'setbal') {
			if (msg.author.id === ownerID) { //We only want the bot owner to set balance of other users
				var user = msg.mentions.users.first().id //Who did we mention to change their balance?
				var amount = args[1] //Amount of arguments in our command
				if (!user) return msg.reply('Whos balance are you wanting to set?') //If we didnt specify the user, reject the command
				if (!amount) return msg.reply('Specify the amount you want to set it as!') //If we didnt specify amount, reject once again.
				db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits=' + Auser + ' WHERE discordLinkID="'+msg.author.id+'";'), function (err) {
					if (err) throw err;
				}
				msg.reply(`Set  coins for ` + msg.mentions.users.first() + '!'); //And send a success message so we know it worked.
			} else { //If they arent the bot owner, reject!
				msg.reply('Nice try. You dont have access to that command.');
			}
		}

		if (command === 'transfer') {
			var user = msg.mentions.users.first();
			var amount = args[1];
			var Auser;
			var Buser; // Auser >> Buser || Auser - amount > Buser + amount
			if (!user) return msg.reply('Reply the user you want to send money to!');
			if (!amount) return msg.reply('Specify the amount you want to pay!');
			//if (output.balance < amount) return msg.reply('You have fewer coins than the amount you want to transfer!');
			if (amount < 1) return msg.reply('Thats not enough credits!');
			//Remove amount from user A
			db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
				Auser = rows[0].kaibuxCredits - amount;
				if(Auser < 0) {
					logger("Discord","This user "+msg.author.username+" does not have enough credits!","WARN");
				}
				else {
					logger("Discord",'Updating bank account for user ' + msg.author + ' to amount ' + Auser, "WARN")
					db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits=' + Auser + ' WHERE discordLinkID="'+msg.author.id+'";', function (err, rows, fields) {
						if (err) throw err;
						logger("Discord",'Removed from ' + msg.author.username + 'successfully... Adding to user B!', "WARN");
					});
				}
			});
			//Add amount to user B
			db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.mentions.users.first().id, function (err, rows, fields) {
				Buser = Math.abs(rows[0].kaibuxCredits) + Math.abs(amount);
				logger("Discord",'Updating bank account for user ' + msg.mentions.users.first() + ' to amount ' + Buser, "WARN")
				db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits=' + Auser + ' WHERE discordLinkID="'+msg.author.id+'";', function (err, rows, fields) {
					if (err) throw err;
					logger("Discord",'Added to ' + msg.mentions.users.first() + 'successfully! Transaction success!', "WARN");
				});

				//Update transaction logs
				db.query('INSERT INTO sabre_accts.transactions (`from`,`to`,`amount`,`timestamp`) VALUES ("'+msg.author.username+'","'+user.username+'",'+amount+',"'+currentTime()+'");', function(err,rows,fields) { //Updates bank info instead of replacing (which may cause errors due to SQL Primary Keys)
					if(err) throw err;
					logger("Discord",'Updated transaction table',"INFO");
				});

			});
			msg.reply(`Transfering of KaiBux successfully done!`);
			kaiStat('Transfered ' + amount + ' credits to ' + msg.mentions.users.first().username + ' from ' + msg.author.username + 's account');
		}

		//Link SabreSSO to Kaivax
		if(command === 'linkssso') {
			var sabressoUsr = args[0];
			if(args[0] == undefined) {
				msg.reply('Please specify your SabreSSO username!');
			}
			db.query('SELECT * FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
				var usrKaibux = rows[0].kaibuxCredits;
				if (err) return msg.reply('Sorry, I had an issue trying to link your account... Try again later.');
				msg.reply('Finding your user ID...'+client.emojis.get("650888034991996949"));
				db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits=' + usrKaibux + 'WHERE username="' + sabressoUsr + '";', function (err, rows, fields) {
					if (err) return msg.reply('Sorry, I had an issue trying to link your account... Try again later.');
					msg.reply('Successfully linked your account! ' + client.emojis.get('647302236170616852'));
				});
			});
		}

		//Discord Shop > Minecraft
		if (command === 'shop') {
			var cmd = args[0];
			var item = args[1];
			var MCUser = args[2];
			if (cmd === 'buy') {
				//4 Diamonds at the price of 400 Kaibux
				if (MCUser != undefined) {
					db.query('SELECT * FROM kaivax.mc_eco WHERE packageID=' + item, function (err, rows, fields) {
						var packPrice = rows[0].kbPrice;
						var item = rows[0].item;
						var quan = rows[0].quanity;
						var packID = rows[0].packageID;
						db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + msg.author.id, function (err, rows, fields) {
							if (Math.abs(rows[0].kaibuxCredits) < packPrice) {
								msg.reply('You dont have enough credits!');
							}
							if (Math.abs(rows[0].kaibuxCredits) > packPrice) {
								mc.send('give ' + MCUser + ' ' + item + ' ' + quan);
								mc.send('tell ' + MCUser + ' Kaivax> Happy hunting!');
								msg.reply('Gave ' + quan + ' ' + item + ' to Minecraft user: ' + MCUser)
								db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits=' + (Math.abs(rows[0].kaibuxCredits) - 400) + ' WHERE discordLinkID="'+msg.author.id+'";', function (err, rows, fields) {
									if (err) throw err;
								});
								//Update our transaction table.
								db.query('INSERT INTO sabre_accts.transactions (`from`,`to`,`amount`,`timestamp`) VALUES ('+msg.author.username+',"kaivax",'+packPrice+',"'+currentTime()+'");', function(err,rows,fields) { //Updates bank info instead of replacing (which may cause errors due to SQL Primary Keys)
									if(err) throw err;
									logger("Discord",'Updated transaction table',"INFO");
								});
							}
						});
					});
				}
				else {
					msg.reply('You did not specify a Minecraft user!');
				}
			}
		}
});
//END Discord API Settings========================================================================================================================================================

//Telegram Messaging
tgBot.onText(/\/ravenlog (.+)/, (msg, match) => {
	logger(msg)
	const chatId = msg.chat.id;
	const command = match[1];
	// send back the matched "whatever" to the chat
	logger('Telegram',msg,'INFO')
	if(command == 'LIST') {
		tgBot.sendMessage(chatId,'Last log entered:');
		db.query("SELECT * FROM kaivax.raven ORDER BY logname ASC;", function (err,result,fields) {
			if (err) {
				logger("Discord",'Could not display content!',"WARN")
			}
			var row1 = JSON.parse(JSON.stringify(result[0]));
			tgBot.sendMessage(chatId,'Log ID: ' + row1.logname);
			tgBot.sendMessage(chatId,'Status: ' + row1.status);
			tgBot.sendMessage(chatId,'Content: ' + row1.content);
			kaiStat('Listed latest updates to RL.');
		});
	}
});
tgBot.on('message', (msg) => {
	tgMsgCnt.inc();
	const chatId = msg.chat.id;
	if(msg.text == '/ravenlog') {
		tgBot.sendMessage(chatId, 'Welcome, ' + msg.from.first_name +
			'\n RavenLogging System Commands: \n' +
			'LIST - List the latest log from the database \n' +
			'NEW - Create a new RavenLog.');
	}
	logger('Telegram',' UserID:' + msg.chat.id + ' Content: ' + msg.text,"INFO");
});
//End Telegram Messaging
client.once('reconnecting', () => {
	logger("Discord","Having issues connecting to the Discord API, hang tight...","INFO")
});
client.once('disconnect', () => {
	logger("Discord","We have disconnected from the Discord API! Unknown error","INFO")
});
//Send and receive with our own API
app.get("/wp-admin", (req, res, next) => {
	res.send('No!');
});
//Send responses
app.get("/botstats/msgtx", (req, res, next) => {
	res.send(' ' + msgSent_session);
});
app.get("/botstats/msgrx", (req, res, next) => {
	res.send(' ' + msgReciv_session);
});
app.get("/botstats/msgtotal", (req, res, next) => {
	res.send(' ' + msgTotal_session);
});
app.get("/botstats/msg", (req, res, next) => {
	res.send(lastMsg);
});
//Recieve messages to send to selected channel.
app.get("/input/msgProc", (req, res, next) => {
	msgAnnounce = req.query['msgDC'];
	msgAnnounceID = req.query['msgID'];
	if(msgAnnounceID == undefined) {
		res.status(400).send('Your request was not complete. Please check and try again.\n' +
			'Recieved Message Announcement: ' + msgAnnounce + '\n' +
			'Recieved Message ID: ' + msgAnnounceID + '\n');
		logger("KaiAPI",'An API request failed.\n' +
			' Request Type: Send Message \n' +
			' Message: ' + msgAnnounce +
			'\n Channel: ' + msgAnnounceID,"WARN");
	}
	res.status(200).send('Success. Message to channel ' + msgAnnounceID + ' with content ' + msgAnnounce + ' was sent to KaiAPI.');
	logger("KaiAPI",'An API request was completed. \n' +
		' Request Type: Send Message \n' +
		' Message: ' + msgAnnounce +
		'\n Channel: ' + msgAnnounceID,"WARN");
});
//Recieve user ID to send back Username
app.get("/input/idtoname", (req, res, next) => {
	var usrID = req.query['usrID'];
	var usrName;
	if(usrID == undefined) {
		res.status(400).send('Your request was not complete. Please check and try again.\n' +
			'Recieved UserID: ' + usrID);
		logger("KaiAPI",'An API request failed.\n' +
			' Request Type: Retrieve Username from ID \n' +
			' UserID: ' + usrID,"WARN");
	}
	grabDCUsrname(usrID);
	res.status(200).send(usrName);
	logger("KaiAPI",'An API request was completed.\n' +
		' Request Type: Retrieve Username from ID \n' +
		' UserID: ' + usrID +
		'\n Username: ' + usrName,"WARN");
});
//Functions========================================================================
function logMsgs(userID,username,messageContent,time){
	db.query('INSERT INTO kaivax.discordmsgs (userID,username,message,timestamp) VALUES('+userID+',"'+username+'","'+messageContent+'","'+time+'");',function(err,rows,fields) {
		if(err) throw err;
	});
}
function kaiMetrics(type,count) {
	if(type == 'dcMsg') {
		dcMsgCnt.inc();
	}
	if(type == 'tgMsg') {
		tgMsgCnt.inc();
	}
	if(type == 'db') {
		dbQ.inc()
	}
}
function kaiStat(status) {
	kaiStatus = status;
	client.user.setActivity(status);
	if(status === undefined) {
		kaiStatus = 'Running...';
		client.user.setActivity('Awaiting commands.');
	}
}
function ravenlog(name,action,cont,status) {
	var createLog = "INSERT INTO kaivax.raven(logname, content, status) VALUES ('" + name + "','" + cont + "','" + status +"');";
	var listLog = "SELECT * FROM kaivax.raven ORDER BY logname ASC LIMIT 5;"
	if(action === "CREATE") {
		db.query(createLog), function (err) {if(err) throw err;}
	}
	if(action === "LIST") {
		db.query(listLog), function (err,result,fields) {
			if(err) throw err;
			return result;
		}
	}
}
function kaibux(userID,amt) {
	var sabressoUsr;
	db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + userID , function(err,rows,fields) { //Select the user from the database
		if(err) {
			db.query('INSERT INTO sabre_accts.sabresso ("username","discordLinkID","email") VALUES("noUsrname",'+userID+',"None");',function(err,rows,fields) { //Create a new user if it doesnt exist and enter it into the database
				if(err) throw err;
				kaiStat('Whoops! That isnt supposed to happen.');
			});
		}
		logger("Discord",'Updating bank account for user ' + userID + ' to amount ' + (Math.abs(rows[0].kaibuxCredits)+amt),"WARN")
		db.query('UPDATE sabre_accts.sabresso SET kaibuxCredits='+(Math.abs(rows[0].kaibuxCredits)+amt)+' WHERE discordLinkID="'+userID+'";', function(err,rows,fields) { //Updates bank info instead of replacing (which may cause errors due to SQL Primary Keys)
			if(err) throw err;
			logger("Discord",'Added to ' + userID + 'successfully! Transaction success!',"WARN");
			kaiStat('Updated bank info');
		});

	});
}
function kaibuxChk(userID,amt) {
	var response;
	db.query('SELECT kaibuxCredits FROM sabre_accts.sabresso WHERE discordLinkID=' + userID , function(err,rows,fields) {
		logger("Discord",Math.abs(rows[0].kaibuxCredits) + ' - ' + amt,"WARN")
		if(Math.abs(rows[0].kaibuxCredits) < amt) {
			response = false;
		}
		if(Math.abs(rows[0].kaibuxCredits) > amt) {
			response = true;
		}
	});
	return response;
}
function remove(username, text){
    return text.replace("@" + username + " ", "");
}
function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}
function currentTime() { //We would like to log when something happened in logs, so lets put it in a nice and neat function that calulates it and returns date and time.
	let date_ob = new Date();
	let date = ("0" + date_ob.getDate()).slice(-2);
	let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
	let year = date_ob.getFullYear();
	let hours = date_ob.getHours();
	let minutes = date_ob.getMinutes();
	let seconds = date_ob.getSeconds();
	return date + "-" + month + "-" + year + "_" + hours + ":" + minutes + ":" + seconds //Format DAY-MONTH-YEAR / HH:MM:SS Ex. 25-02-1969/04:20:03
}
function getGuildStats() { //Statistics about our Discord server
	const guild = client.guilds.get('625913986608791562'); //Get the ID of our guild and put it into 
	msgTotal_session = msgSent_session + msgReciv_session; //Add up sent and recieved for totals.
	msgAvg_session = msgTotal_session / guild.members.filter(member => !member.user.bot).size; //Get averages
	logger("Discord",'Average messages sent: ' + msgAvg_session + '. Messages by bot: ' + msgSent_session);
	let guildSummary = 'Total messages sent: ' + msgTotal_session + '. Average messages sent (per non-bot user): ' + msgAvg_session;
	return guildSummary;
}
function getSystemStats() { //Statistics about the system we are running the bot on.
	let usedMemByte = os.totalmem() - os.freemem() //Used bytes to megabytes
	let usedMemMB = usedMemByte/1024/1024/1024;
	
	let freeMemMB = os.freemem()/1024/1024/1024; //Free bytes to megabytes
	
	let totalMemMB = os.totalmem()/1024/1024/1024;//Total bytes to megabytes
	
	let osInfo = 'We are running on ' + os.platform() + ' on release ' + os.release() + ' with a hostname of ' + os.hostname() + ' ';
	let hardwareInfo = 'Our current memory usage is ' + usedMemMB + ' MB. Total memory installed for ' + os.hostname() + ' is ' + totalMemMB + 
	' GB (or so we can use). We are running on a ' + os.arch() + ' based CPU ';
	if(usedMemMB > freeMemMB) {
        let sysSummary = osInfo + hardwareInfo + '.  You are low on RAM!';
    } 
    else {
        let sysSummary = osInfo + hardwareInfo + '. You have sufficient RAM.';
    }
	return sysSummary;
}
function logger(platform,content,type) {
	/*
	 * Valid types are:
	 * INFO - Debug logging. Reports variables. Should be console only, dont fill the logs with spam.
	 * WARN - Strange errors but the bot can still run its process. Log to discord channel but dont ping.
	 * ALERT - Critical errors and security alerts. Ping owner!
	*/ 
	var alertChannel = '705336893717348374';
	if(type == 'INFO') {
		console.log(currentTime() + ' [INFO] ' + '<' + platform + '>' + content);
	}
	if(type == 'WARN') {
		console.log(currentTime() + ' [WARN] ' + '<' + platform + '>' + content);
		client.channels.get('705336893717348374').send(currentTime() + ' [WARN] ' + '<' + platform + '>' + content); //Send to #logs channel, but dont ping.
	}
	if(type == 'ALERT') {
		console.log(currentTime() + ' [ALERT] ' + '<' + platform + '>' + content);
		client.channels.get(alertChannel).send(currentTime() + ' [ALERT] ' + '<' + platform + '>' + content + '<@612376517686853653>'); //Send to #logs channel, but DO ping.
		client.channels.get(alertChannel).send(getSystemStats() + getGuildStats());
	}
	if(type == 'CRIT') {
		console.log(currentTime() + ' [CRITICAL] ' + '<' + platform + '>' + content);
		client.channels.get('alertChannel').send(currentTime() + ' [CRITICAL] ' + '<' + platform + '>' + content + '<@626254804913750037>');
	}
	if(type == 'ANNOUNCE') {
		console.log(currentTime() + ' [Announcement] ' + content);
		client.channels.get('708934841999163402').send(currentTime() + ' [Announcement] ' + content);
	}
}
