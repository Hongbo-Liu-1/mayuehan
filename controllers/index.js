'use strict';

const express = require('express');

const Activeversion = require('./Activeversion');
const Health = require('./Health');
const Registration = require('./registration');

/**
 *
 * @param {!HealthRouteOptions} healthRouteOptions
 * @param {!ActiveVersionRouteOptions} activeVersionRouteOptions
 * @returns {!Router}
 */
function getControllers({ healthRouteOptions, activeVersionRouteOptions }) {
    const router = express.Router();

    router.use(
        '/',
        Health.getNewRouter(healthRouteOptions),
        Activeversion.getNewRouter(activeVersionRouteOptions),
        Registration.getNewRouter(activeVersionRouteOptions)
    );

    return router;
}

module.exports = {
    getControllers
};
