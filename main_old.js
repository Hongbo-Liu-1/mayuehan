'use strict';

/**
 * According to https://www.npmjs.com/package/inversify:
 * "The reflect-metadata polyfill should be imported only once in your entire application because the
 * Reflect object is mean to be a global singleton."
 */
require('reflect-metadata');

const Log = require('./libs/Log');
const pkg = require('./package');
const { WebApp } = require('./WebApp');

const { container } = require('./di-composable-root');

const logger = Log.getLogger();

async function main() {
    logger.info('Starting 2019 Tsinghua North American Alumni Ma Yue Han Cup\n\n');

    // Get the WebApp instance to cause it to be started
    // eslint-disable-next-line no-unused-vars
    const webApp = container.get(WebApp);
}

if (require.main === module) {
    main();
}
