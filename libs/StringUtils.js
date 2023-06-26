'use strict';

/**
 *
 * @param {!String} str
 * @returns {!Boolean}
 */
function isStringUndefinedOrEmpty(str) {
    return !str || !str.trim();
}

/**
 *
 * @param {!String} str
 * @returns {!Boolean}
 */
function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
}

module.exports = {
    isStringUndefinedOrEmpty,
    isString
};
