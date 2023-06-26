'use strict';

const lodash = require('lodash');
const moment = require('moment');
const { oneLine } = require('common-tags');

const Exception = require('../../exceptions/Exception');
const Log = require('../../Log');

const sql = require('./sql');

const logger = Log.getLogger();

/**
 * @typedef {Object} VersionRepository~Versions
 * @property {?String} schemaVersion
 * @property {?Moment} schemaVersionUpdateDate
 * @property {?String} activeVersion
 * @property {?Moment} activeVersionUpdateDate
 */

/**
 *
 * @param {!Object} row
 * @returns {!VersionRepository~Versions}
 */
function versions(row) {
    return {
        schemaVersion: row.schema_version,
        schemaVersionUpdateDate: row.schema_version_update_date === null ? null : moment(row.schema_version_update_date),
        activeVersion: row.active_version,
        activeVersionUpdateDate: row.active_version_update_date === null ? null : moment(row.active_version_update_date)
    };
}

class VersionRepository {
    /**
     *
     * @param {!pgPromise.IDatabase} database
     * @param {!CommandBuilder} commandBuilder
     */
    constructor({ database, commandBuilder }) {
        this.database = database;
        this.commandBuilder = commandBuilder;
    }

    /**
     *
     * @return {!Promise<void>} resolved if the table gets created and initialized successfully
     */
    async createTable() {
        logger.debug('Creating version table');

        const command = this.commandBuilder.getOrCreateHystrixCommand(
            'DB-version-createTable',
            this.database.none.bind(this.database)
        );

        try {
            await command.execute(sql.createTable);
        } catch (error) {
            const message = 'Error when creating version table';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }
    }

    /**
     *
     * @return {!Promise<?VersionRepository~Versions>} resolved to null if there is no versions in the table
     */
    async getVersions() {
        logger.debug('Getting versions');

        const command = this.commandBuilder.getOrCreateHystrixCommand(
            'DB-version-getVersions',
            this.database.oneOrNone.bind(this.database)
        );

        let row;
        try {
            row = await command.execute(sql.getVersions);
        } catch (error) {
            const message = 'Error when getting versions';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }

        return row === null ? null : versions(row);
    }

    /**
     *
     * @param {?String|undefined} schemaVersion - will not be updated if null or undefined specified
     * @param {?String|undefined} activeVersion - will not be updated if null or undefined specified
     * @return {!Promise<!VersionRepository~Versions>}
     */
    async updateVersions({ schemaVersion, activeVersion } = {}) {
        logger.debug(oneLine`Updating versions
            ${lodash.isNil(schemaVersion) ? '' : `, schemaVersion: ${schemaVersion}`}
            ${lodash.isNil(activeVersion) ? '' : `, activeVersion: ${activeVersion}`}`);

        const command = this.commandBuilder.getOrCreateHystrixCommand(
            'DB-version-updateVersions',
            this.database.one.bind(this.database)
        );

        let row;
        try {
            row = await command.execute(sql.updateVersions, {
                schema_version: schemaVersion,
                schema_version_update_date: lodash.isNil(schemaVersion)
                    ? undefined
                    : moment()
                          .utc()
                          .format(),
                active_version: activeVersion,
                active_version_update_date: lodash.isNil(activeVersion)
                    ? undefined
                    : moment()
                          .utc()
                          .format()
            });
        } catch (error) {
            const message = 'Error when updating versions';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }

        return versions(row);
    }

    /**
     *
     * @return {!Promise<void>}
     */
    async dropTable() {
        logger.debug('Dropping version table');

        const command = this.commandBuilder.getOrCreateHystrixCommand(
            'DB-version-dropTable',
            this.database.none.bind(this.database)
        );

        try {
            await command.execute(sql.dropTable);
        } catch (error) {
            const message = 'Error when dropping version table';
            logger.error(message, error);
            throw new Exception(message, { cause: error });
        }
    }
}

module.exports = VersionRepository;
