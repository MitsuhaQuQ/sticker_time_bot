const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;
const fs = require('fs');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;

const logger = createLogger({
    level: (typeof config.level == 'undefined') ? 'info' : config.level,
    format: combine(
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: config.log_file })
    ]
});

const token = config.tg_bot_token;

const sticker1040 = 'CAADBQADAQAD9tu2MpYEjqu_M70iAg' ;

const bot = new TelegramBot(token, { polling: true });


if (fs.existsSync('./data.json')) {
    var fdata = fs.readFileSync('./data.json', 'utf8');
    var data = JSON.parse(fdata);
    logger.info('Old data: ' + JSON.stringify(data));
}

function saveData() {
    json = JSON.stringify(data);
    fs.writeFile("./data.json", json , 'utf8',  function(err, written, buffer) {});
}

if (typeof data == 'undefined' || data == null) {
    logger.info('No data.json');
    var data = {
        chatids: [],
        tzmap: {},
        lastid: {},
        autodelete: {}
    };
    saveData();
}

if (typeof data.chatids == 'undefined' || data.chatids == null) {
    data.chatids = [];
    saveData();
}

if (typeof data.tzmap == 'undefined' || data.tzmap == null) {
    data.tzmap = {};
    saveData();
}

if (typeof data.lastid == 'undefined' || data.lastid == null) {
    data.lastid = {};
    saveData();
}



bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index > -1) {
        bot.sendMessage(chatId, 'Already started, chat ID: ' + chatId);
        return;
    }
    data.chatids.push(chatId);
    delete data.lastid[chatId];
    saveData();
    logger.info(chatId + ' started');
    bot.sendMessage(chatId, 'Started, chat ID: ' + chatId);
});

bot.onText(/^\/timezone(@sticker_time_bot)?(\s+([^\s]+))?$/, (msg, match) => {
	const chatId = msg.chat.id;
    if (match[3]) {
        if (moment.tz.zone(match[3])) {
            logger.info(chatId + ' set timezone to ' + match[3]);
            bot.sendMessage(chatId, 'Set timezone to ' + match[3]);
            data.tzmap[chatId] = match[3];
            saveData();
        } else {
            bot.sendMessage(chatId, 'Invalid timezone: ' + match[3]);
        }
    } else {
        let tz = data.tzmap[chatId];
        if (tz) {
            bot.sendMessage(chatId, 'Current timezone: ' + data.tzmap[chatId]);
        } else {
            bot.sendMessage(chatId, 'Timezone not set, by default Asia/Shanghai.');
        }
    }
});



bot.onText(/\/stop/, (msg) => {
	const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index > -1) {
        data.chatids.splice(index, 1);
        delete data.lastid[chatId];
        saveData();
    } else {
        bot.sendMessage(chatId, 'Not started, chat ID: ' + chatId);
        return;
    }
    logger.info(chatId + ' stopped');
    bot.sendMessage(chatId, 'Stopped, chat ID: ' + chatId);
});

bot.onText(/\/ping/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, 'Arrrrr.');
});

bot.onText(/\/trainnow/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, 'The controller says "WE NEED A TRAIN!".');
	bot.sendSticker(chatId, sticker1040 );
});

// bot.on('sticker', (msg) => {
    // const chatId = msg.chat.id;
    // logger.info('[' + chatId + '] ' + msg.sticker.file_id);
// });

bot.on('polling_error', (error) => {
    logger.error('[polling_error] ' + error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
    logger.error('[webhook_error] ' + error.code);  // => 'EPARSE'
});

var cron = new CronJob('38 10,22 * * *', function() {
	var date = new Date();
    data.chatids.forEach(function (id) {
        let tz = data.tzmap[id];
        if (!tz) {
            tz = 'Asia/Shanghai';
        }
		
		logger.debug('Send prepar ' + id);
		bot.sendMessage(id, 'Attention please. The train number G1040 is now arriving at platform 9.');
		bot.sendMessage(id, 'Please hold your ticket.');
	});
}, null, true, 'Asia/Shanghai');

// when 10:40 or 22:40 send a sticker
var cron = new CronJob('40 10,22 * * *', function() {
    var date = new Date();
    logger.info('Cron triggered: ' + date + ', send sticker to ' + data.chatids.length + ' chats');
    data.chatids.forEach(function (id) {
        let tz = data.tzmap[id];
        if (!tz) {
            tz = 'Asia/Shanghai';
        }

        logger.debug('Send to ' + id);
        bot.sendSticker(id, sticker1040 ).then(message => {
            let cid = message.chat.id;
            let mid = message.message_id;
            if (data.autodelete[cid] && data.lastid[cid]) {
                bot.deleteMessage(cid, data.lastid[cid]);
            }
            data.lastid[cid] = mid;
            saveData();
        }).catch(error => {
            let query = error.response.request.uri.query;
            let matches = query.match(/chat_id=(.*)&/);
            if (matches && matches[1]) {
                let cid = Number(matches[1]);
                if (isNaN(cid)) {
                    // Channel name
                    cid = matches[1];
                    cid = cid.replace('%40', '@');
                }
                logger.error('[' + error.response.body.error_code + '](' + cid + ')' + error.response.body.description);  // => 'ETELEGRAM'
                if (query && (error.response.body.error_code === 403 || error.response.body.error_code === 400) &&
                (error.response.body.description.includes('blocked') ||
                    error.response.body.description.includes('kicked') ||
                    error.response.body.description.includes('not a member') ||
                    error.response.body.description.includes('chat not found') ||
                    error.response.body.description.includes('upgraded') ||
                    error.response.body.description.includes('deactivated') ||
                    error.response.body.description.includes('not enough rights') ||
                    error.response.body.description.includes('have no rights') ||
                    error.response.body.description.includes('CHAT_SEND_STICKERS_FORBIDDEN'))) {
                    logger.info('Blocked by ' + cid);
                    let index = data.chatids.indexOf(cid);
                    if (index > -1) {
                        data.chatids.splice(index, 1);
                        delete data.tzmap[cid];
                        delete data.lastid[cid];
                        delete data.autodelete[cid];
                        delete data.sleeptime[cid];
                        delete data.waketime[cid];
                        saveData();
                    }
                }
            }
        })
    });
}, null, true, 'Asia/Shanghai');

var cron = new CronJob('41 10,22 * * *', function() {
	var date = new Date();
    data.chatids.forEach(function (id) {
        let tz = data.tzmap[id];
        if (!tz) {
            tz = 'Asia/Shanghai';
        }
		
		logger.debug('Send end ' + id);
		bot.sendMessage(id, 'Doooooors are closing.....');
	});
}, null, true, 'Asia/Shanghai');