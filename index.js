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
        bot.sendMessage(chatId, '前方区间已经有列车！');
		bot.sendVoice(chatId, 'ATS.ogg');
        return;
    }
    data.chatids.push(chatId);
    delete data.lastid[chatId];
    saveData();
    logger.info(chatId + ' started');
    bot.sendMessage(chatId, '已启动，你的ID为：' + chatId);
	bot.sendVoice(chatId, 'ATC_Ding.ogg');
});

bot.onText(/\/stop/, (msg) => {
	const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index > -1) {
        data.chatids.splice(index, 1);
        delete data.lastid[chatId];
        saveData();
    } else {
        bot.sendMessage(chatId, '未启动，您的ID为：' + chatId);
        return;
    }
    logger.info(chatId + ' stopped');
    bot.sendMessage(chatId, '已停止，您的ID为：' + chatId);
	bot.sendVoice(chatId, 'ATC_Ding.ogg');
});

bot.onText(/\/ping/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendVoice(chatId, 'ATC_Ding.ogg');
});

bot.onText(/\/trainnow/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, '加开列车！');
	bot.sendVoice(chatId, 'ATC_Ding.ogg');
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
		bot.sendVoice(chatId, 'ATOS.ogg');
		bot.sendMessage(id, '旅客们请注意，开往 北部湾 方向的 高1040次列车即将到达本站');
		bot.sendMessage(id, '列车到达 9 站台');
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
		bot.sendMessage(id, '列车关门，请乘客们注意安全');
		bot.sendVoice(chatId, 'departure.ogg');
	});
}, null, true, 'Asia/Shanghai');