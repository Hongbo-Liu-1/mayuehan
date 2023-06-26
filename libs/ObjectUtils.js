'use strict';

const lodash = require('lodash');

/**
 *
 * @param {*} obj
 * @param {*} path
 * @param {*} defaultValue
 * @returns {*}
 */
function safeGet(obj, path, defaultValue) {
    return lodash.defaultTo(lodash.get(obj, path), defaultValue);
}

function isMatched(obj, predicates) {
    for (let i = 0; i < predicates.length; ++i) {
        const predicate = predicates[i];

        if (lodash.isFunction(predicate)) {
            if (predicate(obj)) {
                return true;
            }
        } else if (lodash.isRegExp(predicate) && lodash.isString(obj)) {
            if (obj.match(predicate) !== null) {
                return true;
            }
        } else if (obj === predicate) {
            return true;
        }
    }

    return false;
}

/**
 * @callback Mapper
 * @param {!String} key
 * @param {*} value
 * @returns {*} the mapped value
 */

/**
 *
 * @param {*} obj
 * @param {!Mapper} mapper
 * @returns {*}
 */
function deepMapValues(obj, mapper) {
    if (obj === undefined || obj === null) {
        return obj;
    }

    return lodash.mapValues(obj, (value, key) => {
        if (value instanceof Object) {
            return deepMapValues(value, mapper);
        } else {
            return mapper(key, value);
        }
    });
}

/**
 * THIS FUNCTION HAS SOME UNEXPECTED(?) BEHAVIOUR
 * MASKING `foo` on
 * `{foo: ['some', 'strings']}`
 * will result in
 * `{foo: {0: 'some', 1: 'strings'}}`
 *
 * @param {*} obj
 * @param {!Array<!String|!Function|!RegExp|*>} keys - the keys of the values to mask
 * @returns {*}
 */
function mask(obj, keys) {
    return deepMapValues(obj, (key, value) => {
        if (isMatched(key, keys)) {
            return `[MASKED ${value.constructor.name.toUpperCase()}]`;
        } else {
            return value;
        }
    });
}

const DEFAULT_SENSITIVE_KEYS = [/.*password|auth.*/i];

/**
 *
 * @param {*} obj
 * @param {!Array<*>} [sensitiveKeys]
 * @returns {*}
 */
function maskSensitiveInfo(obj, sensitiveKeys) {
    return mask(obj, sensitiveKeys !== undefined ? lodash.union(DEFAULT_SENSITIVE_KEYS, sensitiveKeys) : DEFAULT_SENSITIVE_KEYS);
}

/**
 *
 * @param {*} obj
 * @returns {!String}
 */
function prettyPrint(obj) {
    return JSON.stringify(obj, null, 2);
}

/**
 * Used in conjuction with JSON.stringify to hide stack traces and error contexts but preserve
 * everything else
 *
 * @example
 *  ...
 *  .catch(err => {
 *      logger.error(`failed with error ${JSON.stringify(err, errorReplacer)}`)
 *  });
 *  ...
 *
 * @param {any} key
 * @param {any} value
 */
function errorReplacer(key, value) {
    if (value instanceof Error) {
        const error = {};

        Object.getOwnPropertyNames(value).forEach(function(k) {
            if (k !== 'stack' && k !== 'error@context')
                // don't expose stack traces (besides they're expensive) or error contexts
                error[k] = value[k];
        });

        return error;
    }

    return value;
}

module.exports = {
    safeGet,
    mask,
    maskSensitiveInfo,
    prettyPrint,
    errorReplacer
};
