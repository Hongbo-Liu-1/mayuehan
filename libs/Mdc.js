'use strict';

const clsBluebird = require('cls-bluebird');
const cls = require('cls-hooked');
const lodash = require('lodash');
const moment = require('moment');

const ns = cls.createNamespace(`cls_${moment.utc().format()}`);

// Patch the bluebird to maintain the cls context
clsBluebird(ns);

/**
 *
 * @param {any|!Array<any>} key - the key to get the value
 * @returns {any|!Object|undefined} undefined if the namespace or the key could not be found
 */
function get(key) {
    if (key instanceof Array) {
        return [...new Set(key)].reduce((result, k) => {
            result[k] = ns.get(k);
            return result;
        }, {});
    }

    return ns.get(key);
}

/**
 *
 * @param {!Object} items - the key-value pairs to set
 */
function set(items) {
    lodash.each(items, (value, key) => ns.set(key, value));
}

/**
 *
 * @param {!Function} fn - the function to run
 */
function runAndReturn(fn) {
    return ns.runAndReturn(fn);
}

/**
 *
 * @param {!Function} fn - the function to bind to the given namespace
 * @returns {!Function} the bound function
 */
function bind(fn) {
    return ns.bind(fn);
}

/**
 *
 * @param {!EventEmitter} emitter - the function to bind to the given namespace
 */
function bindEmitter(emitter) {
    ns.bindEmitter(emitter);
}

/**
 *
 * @returns {!String|undefined}
 */
function getCorrId() {
    return get('corrId');
}

function setCorrId(corrId) {
    set({ corrId });
}

module.exports = {
    get,
    set,
    runAndReturn,
    bind,
    bindEmitter,
    getCorrId,
    setCorrId
};
