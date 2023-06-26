'use strict';

const express = require('express');
const HttpStatus = require('http-status-codes');
const lodash = require('lodash');

const Log = require('../libs/Log');
const pkg = require('../package');

const logger = Log.getLogger();

/**
 *
 * @param {!HealthRouteOptions} options
 */
function getNewRouter(options) {
    const router = express.Router();

    /**
     * @swagger
     * /version:
     *   get:
     *     tags:
     *       - Version
     *     description: Returns current version of the application
     *     summary: Returns current version when requested
     *     operationId: runtimeHealthCheck
     *     responses:
     *       '200':
     *         description: responds to indicate service is running
     */
    router.get('/version', (request, response) => {
        response.set('Content-Type', 'text/plain');
        response.send(`${pkg.version}`);
    });

    /**
     * @swagger
     * /health:
     *   get:
     *     tags:
     *       - HealthCheck
     *     description: Ping-like runtime health check
     *     summary: Always returns 200 OK when requested
     *     operationId: runtimeHealthCheck
     *     responses:
     *       '200':
     *         description: responds to indicate service is running
     */
    router.get('/health', (request, response) => {
        return response.json({
            serviceStarted: true,
            status: HealthStatus.UP
        });
    });

    router.get('/health/detail', (request, response) => {
        const dependenciesHealthStatus = Status.getDependenciesHealthStatus();

        try {
            return response.json({
                serviceStarted: true,
                status: HealthStatus.UP,
                dependencyStatus: lodash.reduce(
                    dependenciesHealthStatus,
                    (dependencyStatus, dependencyHealthStatus) => {
                        if (dependencyStatus === HealthStatus.DOWN) {
                            return dependencyStatus;
                        } else if ([HealthStatus.DOWN, HealthStatus.UNKNOWN].includes(dependencyHealthStatus)) {
                            return dependencyHealthStatus;
                        } else {
                            return dependencyStatus;
                        }
                    },
                    HealthStatus.UP
                ),
                dependencyHealth: lodash.reduce(
                    dependenciesHealthStatus,
                    (dependencyHealth, dependencyHealthStatus, dependencyName) => {
                        dependencyHealth[dependencyName] = {
                            status: dependencyHealthStatus,
                            affectsDependencyStatus: true
                        };

                        return dependencyHealth;
                    },
                    {}
                )
            });
        } catch (error) {
            logger.error('Error when getting health detail', error);
            return response.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    });

    return router;
}

module.exports = {
    getNewRouter
};
