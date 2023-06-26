'use strict';

const deepFreeze = require('deep-freeze-node');
const requireUncached = require('require-uncached');

/**
 *
 * @returns {!Object}
 */
function getConfig() {
    // It is possible for this Config module to be fresh required. The fresh require of this module should in turn fresh
    // require the backing config lib.
    return JSON.parse(JSON.stringify(requireUncached('config')));
}

/**
 *
 * @readonly
 * @type {!Object}
 */
const config = deepFreeze(getConfig());

module.exports = config;
