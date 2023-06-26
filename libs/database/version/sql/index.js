'use strict';

const path = require('path');
const pgp = require('pg-promise');

const Exception = require('../../../exceptions/Exception');

/**
 *
 * @param {!String} sqlPath
 * @returns {!pgPromise.QueryFile}
 */
function getQueryFile(sqlPath) {
    const queryFile = new pgp.QueryFile(path.join(__dirname, sqlPath), { minify: true });

    if (queryFile.error !== undefined) {
        throw new Exception('Invalid PostgreSQL SQL file', { cause: queryFile.error });
    }

    return queryFile;
}

module.exports = {
    createTable: getQueryFile('./create_table.sql'),
    getVersions: getQueryFile('./get_versions.sql'),
    updateVersions: getQueryFile('./update_versions.sql'),
    dropTable: getQueryFile('./drop_table.sql')
};
