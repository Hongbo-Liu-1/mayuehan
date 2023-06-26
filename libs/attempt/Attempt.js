'use strict';

const bluebird = require('bluebird');

const Log = require('../Log');

const MaxAttemptsExceededException = require('./MaxAttemptsExceededException');

const logger = Log.getLogger();

/**
 * @callback RetryFunction
 * @returns {Promise<*> | *}
 * @throws {*}
 */

class Attempt {
    /**
     *
     * @param {!Number} retryTimes
     * @param {!Number} retryDelayMillis
     */
    constructor({ retryTimes, retryDelayMillis }) {
        this.retryTimes = retryTimes;
        this.retryDelayMillis = retryDelayMillis;
    }

    /**
     * @typedef {Object} Attempt~AttemptInfo
     * @property {!Attempt~DoRetryFunction} doRetry
     * @property {!Number} attempt
     * @property {!Number} attemptTimes
     * @property {!Boolean} isLastAttempt
     */

    /**
     * @callback Attempt~DoRetryFunction
     * @param {!Object} the error encountered or any object describing the error
     */

    /**
     * @callback Attempt~AttemptFunction
     * @param {!Attempt~AttemptInfo}
     * @returns {any}
     */

    /**
     *
     * @param {!Number} retryTimes
     * @param {!Number} retryDelayMillis
     * @param {!Attempt~AttemptFunction} attemptFn
     * @returns {!Promise<*>} what the given attempt function returns
     */
    static async execute(retryTimes, retryDelayMillis, attemptFn) {
        const attemptTimes = retryTimes + 1;
        const errors = [];

        let attempt;
        let interruptError;

        /* eslint-disable no-await-in-loop */
        for (attempt = 1; attempt <= attemptTimes; ++attempt) {
            let result;
            let error;

            try {
                result = await attemptFn({
                    doRetry: e => {
                        error = e;
                    },
                    attempt,
                    attemptTimes,
                    isLastAttempt: attempt === attemptTimes
                });
            } catch (e) {
                interruptError = e;
                break;
            }

            if (error !== undefined) {
                logger.error(`[Attempt ${attempt}/${attemptTimes}] Error encountered`, error);
                errors.push(error);
                await bluebird.delay(retryDelayMillis);
            } else {
                return result;
            }
        }
        /* eslint-enable no-await-in-loop */

        // Need to log this even if attempt was interrupted an error
        if (attempt === attemptTimes) {
            logger.error(`All ${attemptTimes} attempts failed`);
        }

        if (interruptError !== undefined) {
            logger.error(`[Attempt ${attempt}/${attemptTimes}] Attempt interrupted by error: `, interruptError);
            throw interruptError;
        }

        throw new MaxAttemptsExceededException(`All ${attemptTimes} attempts failed`, { attemptTimes, errors });
    }

    /**
     *
     * @param {!Attempt~AttemptFunction} attemptFn
     * @returns {!Promise<any>} what the given attempt function returns
     */
    execute(attemptFn) {
        return Attempt.execute(this.retryTimes, this.retryDelayMillis, attemptFn);
    }

    /**
     * Reattempt the given function until it returns / resolves to a value.
     * If it throws or rejects, it will wait retryIntervalMillis before trying again.
     * @param {RetryFunction} retryFunction the function to be attempted
     * @param {number} retryIntervalMillis the delay between function attempts
     * @returns {*} the return value of fn
     */
    static async retry(retryFunction, retryIntervalMillis) {
        /* eslint-disable no-await-in-loop */
        /* eslint-disable-next-line no-constant-condition */
        while (true) {
            try {
                return await retryFunction();
            } catch (e) {
                await bluebird.delay(retryIntervalMillis);
            }
        }
        /* eslint-enable no-await-in-loop */
    }
}

module.exports = Attempt;
