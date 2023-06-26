'use strict';

/**
 * Service providing singleton WebApp instance.
 * @module services/WebAppService
 * 
 * Manages the configuration and lifetime of the web app, through the use of the DI container. 
 * The purpose for doing so is:
 * * Enforce the singleton scope.
 * * On activation (i.e. just before first use through the DI container), start the web app taking care
 * to ensure that it is shutdown properly when the time comes.
 * 
 * A WebApp class instance is returned from the container, hence there is a need to bind for the
 * WebApp class type. Annotations are also provided for the class constructor singular object in WebApp.js
 * and bound here so that the web app can be properly configured here too.
 * 
 * To obtain the web app from the DI container...
 * @example
 * 
 const { WebApp } = require('./WebApp');
 const { container } = require('./di-composable-root');

 const webApp = container.get(WebApp);
 * @example

import { WebApp } from './services/WebApp';
import { container } from './di-composable-root';

const webApp: WebApp = container.get(WebApp);
 *
 * Scope: Singleton
 * Activation: Start the web app and ensure clean-up will be done properly
 * Lifetime/Cleanup: Stop the web app
 */

import { Container, interfaces } from 'inversify';

import * as ExitHandler from '../libs/ExitHandler';
import { DI_CONFIG } from '../services/ConfigService';
import { WebApp, WebAppDepInjTypes } from '../WebApp';
import { DI_ACTIVE_VERSION_DB } from './ActiveVersionDatabaseService';

import * as Log from '../libs/Log';
const logger = Log.getLogger();

/**
 * Provide bindings and activation function to the passed container for a singleton WebApp class instance
 * @param container The container to provide bindings and activation function to for a singleton WebApp
 * class instance
 */
export function webAppBind(container: Container) {
    container
        .bind<WebApp>(WebApp)
        .toSelf()
        .inSingletonScope()
        .onActivation((context, webApp) => {
            logger.info('Instantiating/Activating Web App Service');

            // Set-up to stop the webApp on exit...
            container.get<ExitHandler>(ExitHandler).cleanUpWith(() => {
                logger.info('Stopping Web App Service');
                webApp.stop();
                logger.info('Stopped Web App Service');
            });
            // ...and then start it.
            webApp.start();
            logger.info('Instantiated/Activated Web App Service');
        });

    container.bind<any>(WebAppDepInjTypes.WebAppConstructorConfig).toDynamicValue((context: interfaces.Context) => {
        return {
            config: container.get<any>(DI_CONFIG).webApp,
            database: container.get(DI_ACTIVE_VERSION_DB)
        };
    });
}
