'use strict';

const lodash = require('lodash');
const moment = require('moment');

class Exception extends Error {
    /**
     * @typedef {Object} ExceptionOptions
     * @property {!String|undefined} time - the time the error takes place
     * @property {!String|undefined} action - the action triggers the error
     * @property {!Error|undefined} cause - the cause of the error
     */

    /**
     *
     * @param {!String} message
     * @param {!ExceptionOptions} [options]
     */
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.cause = options.cause;

        // Capture error metadata
        this.time = lodash.defaultTo(options.time, moment.utc().format());
        this.action = lodash.defaultTo(options.action, '');
        this.errorDesc = message;

        // Create this.stack property
        Error.captureStackTrace(this, this.constructor);
        const causeStack = lodash.get(this.cause, 'stack');
        if (causeStack) {
            this.stack = `${this.stack}\n${causeStack}`;
        }
    }
}

module.exports = Exception;
