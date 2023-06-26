'use strict';

class TaskPool {
    /**
     * @param {Function: void -> Promise<any>} taskFunc is a function in charge of finding its own
     *      things to do (i.e. it comes bound with a queue). It should return a promise that resolves
     *      when the function has finished its work. If the function rejects/throws, it will continue
     *      to call the next function.
     * @param {Number} numberThreads is the number of concurrent taskFuncs running
     * @param {Number} [spreadIntervalMillis] is the duration (ms) that we should spread our initial
     *      function calls over
     */
    constructor(taskFunc, numberThreads, spreadIntervalMillis = 1000) {
        this.terminatedRunners = new Array(numberThreads);
        this.startTermination = false;
        this.spreadInterval = spreadIntervalMillis;

        for (let i = 0; i < numberThreads; ++i) {
            // give each taskRunner a termination function to alert when cleanup is done
            let resolveWhenTerminated;
            this.terminatedRunners[i] = new Promise(resolve => {
                resolveWhenTerminated = resolve;
            });

            setTimeout(() => {
                this.taskRunner(taskFunc, resolveWhenTerminated);
            }, (i / numberThreads) * this.spreadInterval);
        }
    }

    /**
     * taskRunner runs taskFunc and, upon completion, creates a new task runner
     * @param {Function: void -> Promise<any>} taskFunc
     * @param {Function} resolveWhenTerminated
     */
    taskRunner(taskFunc, resolveWhenTerminated) {
        if (this.startTermination) return resolveWhenTerminated();

        return Promise.resolve()
            .then(taskFunc)
            .catch(() => null) // squash errors
            .finally(() => {
                setImmediate(() => {
                    this.taskRunner(taskFunc, resolveWhenTerminated);
                });
            });
    }

    /**
     * Resolves when all task runners have been shut down.
     * @returns {Promise}
     */
    shutdown() {
        this.startTermination = true;
        return Promise.all(this.terminatedRunners);
    }
}

module.exports = TaskPool;
