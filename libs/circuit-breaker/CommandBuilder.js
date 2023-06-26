'use strict';

const { commandFactory } = require('hystrixjs');

/**
 * @typedef {Object} CommandBuilderConfigs
 * @property {!Number} statisticalWindowMillis
 * @property {!Number} sleepWindowMillis
 * @property {!Number} requestVolumeThreshold
 * @property {!Number} requestTimeoutMillis
 */

/**
 *
 */
class CommandBuilder {
    /**
     * @param {!CommandBuilderConfigs} configs
     */
    constructor(configs) {
        this.requestVolumeThreshold = configs.requestVolumeThreshold;
        this.requestTimeoutMillis = configs.requestTimeoutMillis;
        this.statisticalWindowMillis = configs.statisticalWindowMillis;
        this.sleepWindowMillis = configs.sleepWindowMillis;
    }

    /**
     * @param {!String} commandKey
     * @param {!Function} runFn
     * @param {!Number} statisticalWindowMillis
     * @param {!Number} sleepWindowMillis
     * @param {!Number} requestVolumeThreshold
     * @param {!Number} requestTimeoutMillis
     * @returns {!hystrixjs.Command} the created hystrixjs command
     */
    static getOrCreateHystrixCommand({
        commandKey,
        runFn,
        statisticalWindowMillis,
        sleepWindowMillis,
        requestVolumeThreshold,
        requestTimeoutMillis
    }) {
        return commandFactory
            .getOrCreate(commandKey)
            .statisticalWindowLength(statisticalWindowMillis)
            .circuitBreakerRequestVolumeThreshold(requestVolumeThreshold)
            .circuitBreakerSleepWindowInMilliseconds(sleepWindowMillis)
            .timeout(requestTimeoutMillis)
            .run(runFn)
            .build();
    }

    /**
     * @param {!String} commandKey
     * @param {!Function} runFn
     * @returns {!hystrixjs.Command} the created hystrixjs command
     */
    getOrCreateHystrixCommand(commandKey, runFn) {
        return CommandBuilder.getOrCreateHystrixCommand({
            commandKey,
            runFn,
            statisticalWindowMillis: this.statisticalWindowMillis,
            sleepWindowMillis: this.sleepWindowMillis,
            requestVolumeThreshold: this.requestVolumeThreshold,
            requestTimeoutMillis: this.requestTimeoutMillis
        });
    }

    /**
     * @param {!String} commandKey
     * @param {!Function} runFn
     * @param {!Number} timeoutFactor
     * @returns {!hystrixjs.Command} the created hystrixjs command
     */
    getOrCreateHystrixCommandWithTimeout(commandKey, runFn, timeoutFactor) {
        return CommandBuilder.getOrCreateHystrixCommand({
            commandKey,
            runFn,
            statisticalWindowMillis: this.statisticalWindowMillis,
            sleepWindowMillis: this.sleepWindowMillis,
            requestVolumeThreshold: this.requestVolumeThreshold,
            requestTimeoutMillis: this.requestTimeoutMillis * timeoutFactor
        });
    }
}

/**
 *
 * @type {!CommandBuilder|undefined}
 */
CommandBuilder.defaultBuilder = undefined;

/**
 *
 * @param {!CommandBuilderConfigs} configs
 */
CommandBuilder.createDefaultBuilder = function createDefaultBuilder(configs) {
    CommandBuilder.defaultBuilder = new CommandBuilder(configs);
};

module.exports = CommandBuilder;
