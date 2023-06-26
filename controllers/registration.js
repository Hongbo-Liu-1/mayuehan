'use strict';

const express = require('express');
const HttpStatus = require('http-status-codes');
const joi = require('@hapi/joi');

const Log = require('../libs/Log');

const logger = Log.getLogger();

/**
 * @typedef {Object} ActiveVersionRouteOptions
 * @property {!Database} database
 */

/**
 *
 */
function getNewRouter(options) {
    const router = express.Router();

    router.get('/registration', async (request, response) => {
        logger.info('Active version requested');

        let versions;
        try {
            versions = await options.database.versionRepository.getVersions();
        } catch (error) {
            logger.debug('Error when getting active version.', error);
            return response.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const activeVersion = versions === null ? null : versions.activeVersion;

        if (activeVersion === null) {
            logger.debug('Could not find active version', JSON.stringify(versions));
            return response.sendStatus(HttpStatus.NOT_FOUND);
        }

        logger.debug(`Active version retrieved: ${activeVersion}`);

        return response.type('text/plain').send(activeVersion);
    });

    router.post('/registration', async (request, response) => {
        // Match strings like 9.0.000.00.000, or even 9.0.000.00.000-48015190f
        const matcher = /^\d+\.\d+\.\d+\.\d+.\d+(?:-[0-9a-f]{5,40})?$/;
        const validationResult = joi.validate(
            request.body,
            //
            {
                version: joi
                    .string()
                    .required()
                    .regex(matcher)
            },
            { allowUnknown: true }
        );

        if (validationResult.error) {
            logger.error('Error when validating the request body.', validationResult.error);
            return response.sendStatus(HttpStatus.BAD_REQUEST);
        }

        const activeVersion = validationResult.value.version;

        logger.info(`Updating active version to ${activeVersion} requested`);

        try {
            await options.database.versionRepository.updateVersions({ activeVersion });
        } catch (error) {
            logger.debug('Error when updating active version.', error);
            return response.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return response.sendStatus(HttpStatus.OK);
    });

    return router;
}

module.exports = {
    getNewRouter
};
