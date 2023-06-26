'use strict';

const Log = require('./Log');

const logger = Log.getLogger();

class PeriodicExecution {
    /**
     *
     * @param {!Number} intervalMillis
     * @param {!Function} executionFn
     * @param {!Number} [maxExecutionTimes]
     */
    constructor(intervalMillis, executionFn, maxExecutionTimes) {
        if (intervalMillis === undefined) {
            logger.debug('WARN - Periodic execution has no interval');
        }

        if (maxExecutionTimes !== undefined) {
            const periodExecution = this;
            const originalExecutionFn = executionFn;
            let executionTimes = 0;

            executionFn = async function executeWithTimesLimit() {
                if (executionTimes++ === maxExecutionTimes) {
                    logger.debug(`Max execution times ${maxExecutionTimes} reached, period execution will be terminated`);
                    periodExecution.terminate();
                } else {
                    await originalExecutionFn();
                }
            };
        }

        // Execute the first time
        executionFn();

        // Schedule the rest with interval
        this.interval = setInterval(executionFn, intervalMillis);
    }

    terminate() {
        clearInterval(this.interval);
    }
}

module.exports = PeriodicExecution;
