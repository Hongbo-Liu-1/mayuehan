'use strict';

const appRootPath = require('app-root-path');
const callsites = require('callsites');
const lodash = require('lodash');
const moment = require('moment');
const path = require('path');
const winston = require('winston');

const Mdc = require('./Mdc');

const LEVELS = Object.freeze({
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5
});

const COLORS = Object.freeze({
    fatal: 'red',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'cyan'
});

/**
 *
 * @param {!String} filePath
 * @returns {!string}
 */
function getFileReverseDns(filePath) {
    const parsedFilePath = path.parse(filePath.replace(appRootPath, ''));
    const filePathSegments = path
        .join(parsedFilePath.dir, parsedFilePath.name)
        .split(path.sep)
        .filter(Boolean);
    return [...filePathSegments].join('.');
}

/**
 *
 * @param {!String} loggerName
 * @returns {!LogMeta}
 */
function getLogMeta(loggerName) {
    const callSite = callsites()[2];

    /**
     * @typedef {Object} LogMeta
     * @property {!String} loggerName
     * @property {!String|undefined} callerFileReverseDns
     * @property {!String|undefined} callerFunctionName
     * @property {!String|undefined} callerLineNumber
     */
    return {
        loggerName,
        callerFileReverseDns: callSite.getFileName() ? getFileReverseDns(callSite.getFileName()) : undefined,
        callerFunctionName: callSite.getFunctionName() || undefined,
        callerLineNumber: callSite.getLineNumber() || undefined
    };
}

function formatMessage(options) {
    // Compose timestamp
    const timestamp = moment.utc().format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');

    // Compose log level
    const level = options.colorize
        ? winston.config.colorize(options.level, options.level.toUpperCase())
        : options.level.toUpperCase();

    // Compose logger name
    const loggerName = lodash.defaultTo(options.meta.loggerName, '');

    // Compose caller info
    const callerInfoItems = [];

    if (loggerName === options.meta.callerFileReverseDns) {
        callerInfoItems.push('');
    } else {
        callerInfoItems.push(lodash.defaultTo(options.meta.callerFileReverseDns, ''));
    }

    callerInfoItems.push(
        lodash.defaultTo(options.meta.callerFunctionName, ''),
        lodash.defaultTo(options.meta.callerLineNumber, '')
    );

    const callerInfo = callerInfoItems.join(':');

    // Compose correlation ID
    const correlationId = lodash.defaultTo(Mdc.getCorrId(), '');

    // Compose message
    const { message } = options;

    return `[${timestamp}] [${level}] [${correlationId}] [${loggerName}] [${callerInfo}] ${message}`;
}

function initialize() {
    /* eslint-disable global-require */

    // The require of the below modules has to come before the require of the winston-cfg
    require('./Config');
    require('winston-daily-rotate-file');

    // Require winston-cfg to config winston properly
    require('winston-cfg').winstonCfg();

    // Even though winston has been required earlier, it should have been properly configured by winston-cfg after
    // winston-cfg was required above
    winston.addColors(COLORS);

    // Perform some dirty work to change the formatter of all the configured transports for the default container
    winston.loggers.options.transports.forEach(transport => {
        switch (transport.name) {
            case 'dailyRotateFile':
                transport.options.formatter = formatMessage;
                break;
            default:
                transport.formatter = formatMessage;
                break;
        }
    });

    /* eslint-enable global-require */
}

initialize();

function terminate() {
    return winston.loggers.close();
}

class WinstonLogger {
    /**
     *
     * @param {!String} name
     */
    constructor(name) {
        this.name = name;

        this.logger = winston.loggers.get(name);
        this.logger.setLevels(LEVELS);
        this.logger.level = winston.level;
    }

    fatal(...args) {
        this.logger.fatal(...args, getLogMeta(this.name));
    }

    error(...args) {
        this.logger.error(...args, getLogMeta(this.name));
    }

    warn(...args) {
        this.logger.warn(...args, getLogMeta(this.name));
    }

    info(...args) {
        this.logger.info(...args, getLogMeta(this.name));
    }

    debug(...args) {
        this.logger.debug(...args, getLogMeta(this.name));
    }

    trace(...args) {
        this.logger.trace(...args, getLogMeta(this.name));
    }
}

/**
 * @param {!String} [name]
 * @returns {!WinstonLogger}
 */
function getLogger(name) {
    return new WinstonLogger(name || getFileReverseDns(callsites()[1].getFileName()));
}


module.exports = {
    terminate,
    getLogger
};
