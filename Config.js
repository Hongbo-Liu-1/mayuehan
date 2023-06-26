'use strict';

const deepFreeze = require('deep-freeze-node');
const joi = require('@hapi/joi');

const config = require('./libs/Config');
const JoiUtils = require('./libs/JoiUtils');

const customStringJoi = JoiUtils.getCustomStringJoi();
const requiredIfConditionIsTrue = JoiUtils.getRequiredIfConditionIsTrue();


/**
 * @typedef {Object} Config
 * @property {!Config~Status} status
 * @property {!Config~Winston} winston
 * @property {!Config~Db} db
 * @property {!Config~WebApp} webApp
 * @property {!Config~CircuitBreaker} circuitBreaker
 */
const configSchema = joi.compile({
    /* eslint-disable newline-per-chained-call */

    /**
     * @typedef {object} Config~Status
     * @property {!Boolean} active
     * @property {!Number} activeCheckIntervalMillis
     * @property {!Number} healthCheckIntervalMillis
     */
    // prettier-ignore
    status: {
        active: joi.boolean().required(),
        activeCheckInterval: customStringJoi.string().toTime('ms', 'activeCheckIntervalMillis').required(),
        healthCheckInterval: customStringJoi.string().toTime('ms', 'healthCheckIntervalMillis').required()
    },

    /**
     * @typedef {Object} Config~Winston
     * @property {!String} level
     */
    winston: {
        // prettier-ignore
        level: joi.string().only('fatal', 'error', 'warn', 'info', 'debug', 'trace').required()
    },

    /**
     * @typedef {Object} Config~Db
     * @property {!String} host
     * @property {!String} databaseGroup
     * @property {!String} username
     * @property {!String} password
     * @property {!Number} statementTimeoutMillis
     * @property {!Number} maxConnections
     * @property {!Number} idleConnectionTimeoutMillis
     * @property {!Number} connectionTimeoutMillis
     */
    // prettier-ignore
    db: {
        host: joi.string().required(),
        database: joi.string().allow('').required(),
        username: joi.string().allow('').required(),
        password: joi.string().allow('').required(),
        statementTimeout: customStringJoi.string().toTime('ms', 'statementTimeoutMillis').required(),
        maxConnections: joi.number().integer().min(0).required(),
        idleConnectionTimeout: customStringJoi.string().toTime('ms', 'idleConnectionTimeoutMillis').required(),
        connectionTimeout: customStringJoi.string().toTime('ms', 'connectionTimeoutMillis').required(),
        ssl: joi.boolean().required(),
        ca: joi.string().allow('').optional()
    },

    /**
     *
     * @typedef {Object} Config~WebApp
     * @property {!Config~WebApp~Http} http
     * @property {!Config~WebApp~Https} https
     * @property {!Config~WebApp~BodyLimit} bodyLimit
     */
    webApp: {
        /**
         * @typedef {Object} Config~WebApp~Http
         * @property {!Boolean} enable
         * @property {!Number|undefined} port
         */
        http: {
            enable: joi.boolean().required(),
            port: joi
                .number()
                .integer()
                .min(0)
                .when('enable', requiredIfConditionIsTrue)
        },
        /**
         * @typedef {Object} Config~WebApp~Https
         * @property {!Boolean} enable
         * @property {!Number|undefined} port - can be undefined if enable is false
         * @property {!String|undefined} publicKeyPath - can be undefined if enable is false
         * @property {!String|undefined} privateKeyPath - can be undefined if enable is false
         * @property {!String|undefined} privateKeyPassword - can be undefined if enable is false
         * @property {!String|undefined} caBundlePath - can be undefined if enable is false
         */
        https: {
            enable: joi.boolean().required(),
            port: joi
                .number()
                .integer()
                .min(0)
                .when('enable', requiredIfConditionIsTrue),
            publicKeyPath: joi.string().when('enable', requiredIfConditionIsTrue),
            privateKeyPath: joi.string().when('enable', requiredIfConditionIsTrue),
            privateKeyPassword: joi
                .string()
                .allow('')
                .when('enable', requiredIfConditionIsTrue),
            caBundlePath: joi.string().when('enable', requiredIfConditionIsTrue)
        },
        /**
         * @typedef {Object} Config~WebApp~BodyLimit
         * @property {!String} json
         * @property {!String} text
         * @property {!String} urlencoded
         * @property {!String} raw
         */
        bodyLimit: {
            json: joi.string().required(),
            text: joi.string().required(),
            urlencoded: joi.string().required(),
            raw: joi.string().required()
        }
    },

    /**
     * @typedef {Object} Config~CircuitBreaker
     * @property {!Number} statisticalWindowMillis
     * @property {!Number} sleepWindowMillis
     * @property {!Number} requestVolumeThreshold
     * @property {!Number} dbRequestTimeoutMillis
     */
    // prettier-ignore
    circuitBreaker: {
        statisticalWindow: customStringJoi.string().toTime('ms', 'statisticalWindowMillis').required(),
        sleepWindow: customStringJoi.string().toTime('ms', 'sleepWindowMillis').required(),
        requestVolumeThreshold: joi.number().integer().min(0).required(),
        dbRequestTimeout: customStringJoi.string().toTime('ms', 'dbRequestTimeoutMillis').required()
    }
    /* eslint-enable newline-per-chained-call */
});

/**
 *
 * @returns {!Config}
 * @throws {Exception} if the config is invalid according to the config schema
 */
function getValidatedConfig() {
    return JoiUtils.validate(config, configSchema);
}

/**
 *
 * @readonly
 * @type {!Config}
 */
const validatedConfig = deepFreeze(getValidatedConfig());

module.exports = validatedConfig;
