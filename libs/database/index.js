'use strict';

const bluebird          = require('bluebird');
const pgPromise         = require('pg-promise');

const CommandBuilder    = require("../circuit-breaker/CommandBuilder");
const Exception         = require('../exceptions/Exception');
const Log               = require('../Log');
const ObjectUtils       = require('../ObjectUtils');

const VersionRepository = require('./version/VersionRepository');

const logger = Log.getLogger();

class Database {
    /**
     *
     * @param {!Config} config
     */
    constructor( config ) {
        const pgp = pgPromise({ promiseLib: bluebird });

        /**
         * @private
         * @type {!CommandBuilder}
         */
        this.commandBuilder = new CommandBuilder({
            statisticalWindowMillis: config.circuitBreaker.statisticalWindowMillis,
            sleepWindowMillis: config.circuitBreaker.sleepWindowMillis,
            requestVolumeThreshold: config.circuitBreaker.requestVolumeThreshold,
            requestTimeoutMillis: config.circuitBreaker.dbRequestTimeoutMillis
        });

        const [hostname, port] = config.db.host.split(':');
        /**
         * @private
         * @type {!pgPromise.IDatabase}
         */
        this.database = pgp({
            // pg-promise configurations:
            // https://github.com/vitaly-t/pg-promise/wiki/Connection-Syntax#configuration-object
            host: hostname,
            port,
            database: config.db.database,
            user: config.db.username,
            password: config.db.password,
            statement_timeout: config.db.statementTimeoutMillis,
            // node-pg-pool configurations:
            min: 0,
            max: config.db.maxConnections,
            connectionTimeoutMillis: config.db.connectionTimeoutMillis,
            idleTimeoutMillis: config.db.idleConnectionTimeoutMillis,
            ssl: config.db.ssl
        });

        /**
         *
         * @public
         * @type {!VersionRepository}
         */
        this.versionRepository = new VersionRepository({
            database: this.database,
            commandBuilder: this.commandBuilder
        });

        logger.debug(
            'Database client initialized with ',
            JSON.stringify(ObjectUtils.maskSensitiveInfo(arguments[0])) // eslint-disable-line prefer-rest-params
        );
    }

    async execute(sql, parms) {
        try {
            const results = await this.database.any(sql, parms);
            return results;
        } catch (error) {
            const message = 'Error when query database';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }
    }

    async execute2(sql, parms, cmdKey = 'query') {
        const command = this.commandBuilder.getOrCreateHystrixCommand(cmdKey, this.database.any.bind(this.database));
        
        try {
            const results = await command.execute(sql, parms);
            return results;
        } catch (error) {
            const message = 'Error when query database';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }
    }

    /**
     *
     * @return {!Promise<void>} resolved if ping is successful
     */
    async ping() {
        logger.debug('Pinging database');
        const command = this.commandBuilder.getOrCreateHystrixCommand('DB-ping', this.database.one.bind(this.database));

        try {
            await command.execute('SELECT 1');
        } catch (error) {
            const message = 'Error when pinging database';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }
    }
}

module.exports = Database;
