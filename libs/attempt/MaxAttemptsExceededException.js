'use strict';

const lodash = require('lodash');

const Exception = require('../exceptions/Exception');

class MaxAttemptsExceededException extends Exception {
    /**
     * @typedef {ExceptionOptions} MaxAttemptsExceededExceptionOptions
     * @property {!Number|undefined} attemptTimes
     * @property {!Array<!Object>|undefined} errors
     */

    /**
     *
     * @param {!String} message
     * @param {!MaxAttemptsExceededExceptionOptions} [options]
     */
    constructor(message, options = {}) {
        options.action = lodash.defaultTo(options.action, 'Attempting the same operation');
        super(message, options);
        this.name = this.constructor.name;
        this.attemptTimes = options.attemptTimes;
        this.errors = options.errors;
    }
}

module.exports = MaxAttemptsExceededException;
