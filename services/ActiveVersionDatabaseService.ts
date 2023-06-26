'use strict';

import { Container, interfaces } from 'inversify';

import * as CommandBuilder from '../libs/circuit-breaker/CommandBuilder';
import * as Database from '../libs/database';
import * as ExitHandler from '../libs/ExitHandler';

import { DI_CONFIG } from '../services/ConfigService';

import * as Log from '../libs/Log';
const logger = Log.getLogger();

// Could be more than one instance of the Database class, so create a symbol to allow resolving the active version database
export const DI_ACTIVE_VERSION_DB = Symbol.for('DI_ACTIVE_VERSION_DB');

/**
 * Provide bindings and activation function to the passed container for the active version database.
 * @param container The container to provide bindings and activation function to for the active version database.
 */
export function activeVersionDatabaseBind(container: Container) {
    container
        .bind<Database>(DI_ACTIVE_VERSION_DB)
        .toDynamicValue((context: interfaces.Context) => {
            logger.info('Instantiating Active Version Database Service');
            const config: any = container.get(DI_CONFIG);

            const dbCommandBuilder = new CommandBuilder({
                statisticalWindowMillis: config.circuitBreaker.statisticalWindowMillis,
                sleepWindowMillis: config.circuitBreaker.sleepWindowMillis,
                requestVolumeThreshold: config.circuitBreaker.requestVolumeThreshold,
                requestTimeoutMillis: config.circuitBreaker.dbRequestTimeoutMillis
            });

            return new Database({
                host: config.db.host,
                database: config.db.database,
                username: config.db.username,
                password: config.db.password,
                statementTimeoutMillis: config.db.statementTimeoutMillis,
                maxConnections: config.db.maxConnections,
                idleConnectionTimeoutMillis: config.db.idleConnectionTimeoutMillis,
                connectionTimeoutMillis: config.db.connectionTimeoutMillis,
                ssl: config.db.ssl,
                commandBuilder: dbCommandBuilder
            });
        })
        .inSingletonScope()
        .onActivation((context, database) => {
            logger.info('Activating Active Version Database Service');

            const config: any = container.get(DI_CONFIG);
            const exitHandler: ExitHandler = container.get(ExitHandler);

            exitHandler.cleanUpWith(() => {
                logger.info('Stopping dependencies health check for Active Version Database Service');
                // TODO disconnect db ?
                logger.info('Stopped dependencies health check for Active Version Database Service');
            });
            logger.info('Activated Active Version Database Service');

            return database;
        });
}
