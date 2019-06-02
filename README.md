# Ziben Yunzuo 10:40 Timer bot (Testing)
Telegram Link: [http://t.me/ziben_yunzuo_bot](http://t.me/ziben_yunzuo_bot)

## Introduction
This is a [Telegram](https://telegram.org/) bot sending a sticker when it is 10:40 or 22:40.

## Commands
**Start sending stickers:** `/start`

**Stop sending stickers:** `/stop`

**Set timezone:** `/timezone Asia/Shanghai`

*List of timezones in tz database: [https://en.wikipedia.org/wiki/List_of_tz_database_time_zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)*


## Environment
- Node.js 10

## Installation
```sh
npm install
```

## Configuration
Create a file config.json:
```json
{
    "tg_bot_token": "Your Telegram bot token here",
    "log_file": "Log file"
}
```

## Start
```sh
npm start
```
