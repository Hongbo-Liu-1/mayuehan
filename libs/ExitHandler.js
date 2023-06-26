'use strict';

const bluebird = require('bluebird');
const readline = require('readline');

const Log = require('./Log');
const logger = Log.getLogger();

class ExitHandler {
    constructor(processTitle, cleanUpFns = [], cleanUpLastFns = []) {
        this.cleanUpFns = cleanUpFns;
        this.cleanUpLastFns = cleanUpLastFns;

        // This is needed in order for SIGTERM to work.
        process.title = processTitle;

        /**
         * According to https://nodejs.org/api/process.html#process_signal_events, SIGTERM is not supported on Windows.
         *
         * Hence we need to monitor and simulate the signal manually.
         */
        if (process.platform === 'win32') {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.on('SIGTERM', () => {
                process.emit('SIGTERM');
            });

            this.cleanUpFns.push(() => {
                rl.close();
                return bluebird.resolve();
            });
        }

        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM.');
            this.onExit(0);
        });

        process.on('SIGINT', () => {
            logger.info('Received SIGINT.');
            this.onExit(0);
        });

        process.on('uncaughtException', error => {
            logger.fatal('Uncaught exception:', error);
            this.onExit(1);
        });

        process.on('unhandledRejection', error => {
            logger.fatal('Unhandled rejection:', error);
            this.onExit(1);
        });
    }

    static initialize(processTitle, cleanUpFns, cleanUpLastFns) {
        this.initialized = new ExitHandler(processTitle, cleanUpFns, cleanUpLastFns);
        logger.info('Initialized Exit Handler');
        return this.initialized;
    }

    static cleanUpWith(...cleanUpFns) {
        this.initialized.cleanUpFns.push(...cleanUpFns);
    }

    static cleanUpLastWith(...cleanUpLastFns) {
        this.initialized.cleanUpLastFns.push(...cleanUpLastFns);
    }

    async onExit(code) {
        logger.info(`Exiting with code: ${code}`);

        await this.doCleanups();
        process.exit(code);
    }

    async doCleanups() {
        /* eslint-disable no-console */
        try {
            await bluebird.map(this.cleanUpFns, cleanUpFn => cleanUpFn());
        } catch (error) {
            console.error('Error encountered during cleanup.', error);
        }
        try {
            await bluebird.map(this.cleanUpLastFns, cleanUpFn => cleanUpFn());
        } catch (error) {
            console.error('Error encountered during cleanup.', error);
        }
        /* eslint-enable no-console */
    }
}

module.exports = ExitHandler;