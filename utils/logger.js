const winston = require('winston');
const config = require('../configuration/config');
require('winston-daily-rotate-file');
require('date-utils');

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            colorize: true,
            level: config.logLevel,
            timestamp: function(){return new Date().toFormat('YYYY-MM-DD HH24:MI:SS')}
        })
        ,
        /*
        new winston.transports.DailyRotateFile({
            filename: './logs/server_log',
            datePattern: '_yyyy-MM-dd.log',
            maxsize: 1000000,
            level: config.logLevel,
            json: false,
            timestamp: function(){return new Date().toFormat('YYYY-MM-DD HH24:MI:SS')}
        }) */
    ]
});

module.exports = logger;