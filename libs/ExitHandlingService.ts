'use strict';

/**
 * Service providing singleton ExitHandler class reference. This class reference is used to
 * manage the lifetime of other class instances.
 * @module libs/ExitHandlingService
 * 
 * Manages the configuration and scope ExitHandler class reference, through the use of the DI container. 
 * The purpose for doing so is:
 * * Enforce the singleton scope.
 * * On activation (i.e. just before first use through the DI container):
 * * * Configure it with the package name
 * * * Set-up logging termination as the last thing done on shutdown.
 * 
 * The primary reason for making the ExitHandler class reference available through the DI container is
 * so that other classes can manage the lifetime of their instances when provided by the DI container.
 * 
 * The ExitHandler class reference is returned from the container, hence there is a need to bind for the
 * ExitHandler class type.
 * 
 * To obtain the ExitHandler class reference from the DI container...
 * @example
 * 
 const ExitHandler = require('./libs/ExitHandler');
 const { container } = require('./di-composable-root');

 const exitHandler = container.get(ExitHandler);
 * @example

import * as ExitHandler from '../libs/ExitHandler';
import { container } from './di-composable-root';

const exitHandler: ExitHandler = container.get(ExitHandler);
 *
 * Scope: Singleton
 * Activation: Initialize the ExitHandler and ensure clean-up will be done properly
 * Lifetime/Cleanup: Does its own
 */

import { Container } from 'inversify';

import * as pkg from '../package.json';
import * as ExitHandler from './ExitHandler';

import * as Log from './Log';
const logger = Log.getLogger();

/**
 * Provide bindings and activation function to the passed container for the ExitHandler class reference
 * @param container The container to provide bindings and activation function to for the ExitHandler class reference
 */
export function exitHandlerBind(container: Container) {
    container
        .bind<ExitHandler>(ExitHandler)
        // Using .toDynamicValue().inSingletonScope() so cached and only activated once.
        // .toConstant() seems to activate multiple times
        .toDynamicValue(context => {
            logger.info('Instantiating Exit Handler Service');
            return ExitHandler;
        })
        .inSingletonScope()
        .onActivation((context, exitHandler) => {
            logger.info('Activating Exit Handler Service');
            exitHandler.initialize(pkg.name);
            exitHandler.cleanUpLastWith(Log.terminate);
            logger.info('Activated Exit Handler Service');
            return exitHandler;
        });
}
