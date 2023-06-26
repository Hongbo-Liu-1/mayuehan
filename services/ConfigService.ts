'use strict';

/**
 * Service providing validated application configuration.
 * @module services/ConfigService
 * 
 * Manages the configuration and lifetime of the validated config, through the use of the DI container. 
 * The purpose for doing so is:
 * * Enforce the singleton scope,
 * * Validated configuration is available from the DI container.
 * * On activation (i.e. just before first use through the DI container), it will dump masked values to 
 * a log file at the debug level.
 * 
 * Note: that there is no "decoration" required in Config.js because configuration is neither a type
 * nor does it have a constructor. This is why the DI resolution symbol is found here.
 * 
 * To obtain the config from the DI container...
 * @example
 * 
 const { DI_CONFIG } = require('./services/ConfigService');
 const { container } = require('./di-composable-root');

 const config = container.get(DI_CONFIG);
 * @example

import { DI_CONFIG } from './services/ConfigService';
import { container } from './di-composable-root';

const config: any = container.get(DI_CONFIG);
 *
 * Scope: Singleton
 * Activation: Log configuration
 * Lifetime/Cleanup: None required
 */

import { Container } from 'inversify';

import * as config from '../Config';
import * as ObjectUtils from '../libs/ObjectUtils';

import * as Log from '../libs/Log';
const logger = Log.getLogger();

/**
 * Symbol to use for resolving the validated config object from the DI container.
 */
export const DI_CONFIG = Symbol.for('DI_CONFIG');

/**
 * Provide bindings and activation function to the passed container for validated configuration.
 * @param container The container to provide bindings and activation function to for the validated configuration.
 */
export function configServiceBind(container: Container) {
    container
        .bind<any>(DI_CONFIG)
        // Using .toDynamicValue().inSingletonScope() so cached and only activated once.
        // .toConstant() seems to activate multiple times
        .toDynamicValue(context => {
            logger.info('Instantiating validated configuration Service');
            return config;
        })
        .inSingletonScope()
        .onActivation((context, config) => {
            logger.info('Activating validated configuration Service');
            logger.debug('Configurations loaded: ', JSON.stringify(ObjectUtils.maskSensitiveInfo(config)));
            logger.info('Activated validated configuration Service');
            return config;
        });
}
