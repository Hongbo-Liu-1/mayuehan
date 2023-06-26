'use strict';

const lodash = require('lodash');

const Exception = require('../exceptions/Exception');

class HttpResponseException extends Exception {
    /**
     * @typedef {ExceptionOptions} HttpResponseExceptionOptions
     * @property {!String|undefined} errorEntityName
     * @property {!Object|undefined} errorEntity
     */

    /**
     *
     * @param {!String} message
     * @param {!HttpResponseExceptionOptions} options
     */
    constructor(message, options = {}) {
        const errorStringBuilder = [];
        if (options.errorEntityName !== undefined) {
            errorStringBuilder.push(options.errorEntityName);
        }
        if (options.errorEntity !== undefined) {
            errorStringBuilder.push(JSON.stringify(options.errorEntity));
        }

        options.action = lodash.defaultTo(options.action, 'Making HTTP request');

        super(`${lodash.trimEnd(message, ' .,:;-')}. ${errorStringBuilder.join(': ')}`, options);

        this.name = this.constructor.name;
        this.errorEntityName = options.errorEntityName;
        this.errorEntity = options.errorEntity;
    }
}

module.exports = HttpResponseException;
