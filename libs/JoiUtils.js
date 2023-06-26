'use strict';

const bytes = require('bytes');
const Joi = require('@hapi/joi');
const lodash = require('lodash');
const timestring = require('timestring');

const Exception = require('./exceptions/Exception');
const Log = require('./Log');

const logger = Log.getLogger();

/**
 *
 * @param {!Object} configObject
 * @param {!SchemaLike} configSchema
 * @param {!ValidationOptions} [validationOptions]
 * @returns {!Object}
 * @throws {Exception} if the given config object is invalid according to the given config schema
 */
function validate(configObject, configSchema, validationOptions) {
    const validationResult = Joi.validate(
        configObject,
        configSchema,
        lodash.merge(
            {
                abortEarly: false, // do not error out at the first invalid config, in order to get all the invalid configs
                allowUnknown: true, // allow unknown keys
                stripUnknown: true // get rid off all the unknown keys, strictly follow the schema
            },
            validationOptions
        )
    );

    if (validationResult.error) {
        throw new Exception(`Invalid config: ${validationResult.error.message}`, { cause: validationResult.error });
    } else {
        return validationResult.value;
    }
}

/**
 *
 * @returns {!Joi}
 */
function getCustomStringJoi() {
    /**
     * @typedef {Object} CustomStringJoiUnitConversion
     * @property {!String} type
     * @property {!String|undefined} unit
     * @property {!String|undefined} toKey
     */

    return Joi.extend(joi => ({
        /* eslint-disable no-underscore-dangle */
        base: joi.string(),
        name: 'string',
        pre(value, state, options) {
            if (options.convert && this._flags.unitConversion !== undefined) {
                let convertedValue;
                switch (this._flags.unitConversion.type) {
                    case 'time':
                        convertedValue = timestring(value, this._flags.unitConversion.unit);
                        break;
                    case 'bytes':
                        convertedValue = bytes(value);
                        break;
                    default:
                        logger.debug(`Unrecognized unit conversion type: ${this._flags.unitConversion.type}`);
                        break;
                }

                if (this._flags.unitConversion.toKey !== undefined) {
                    state.parent[this._flags.unitConversion.toKey] = convertedValue;
                } else {
                    value = convertedValue;
                }
            }

            return value;
        },
        rules: [
            {
                // Convert the timestring to the number in the given time unit
                name: 'toTime',
                params: {
                    unit: joi.string().required(),
                    toKey: joi
                        .string()
                        .allow('')
                        .optional()
                },
                setup(params) {
                    /**
                     *
                     * @type {!CustomStringJoiUnitConversion}
                     */
                    this._flags.unitConversion = {
                        type: 'time',
                        unit: params.unit,
                        toKey: params.toKey
                    };
                }
            },
            {
                // Convert the string to the number bytes
                name: 'toBytes',
                params: {
                    toKey: joi
                        .string()
                        .allow('')
                        .optional()
                },
                setup(params) {
                    /**
                     *
                     * @type {!CustomStringJoiUnitConversion}
                     */
                    this._flags.unitConversion = {
                        type: 'bytes',
                        toKey: params.toKey
                    };
                }
            }
        ]
        /* eslint-enable no-underscore-dangle */
    }));
}

/**
 *
 * @returns {{is: !BooleanSchema, then: !Schema, otherwise: !Schema}}
 */
function getRequiredIfConditionIsTrue() {
    return {
        is: Joi.boolean().equal(true),
        then: Joi.required(),
        otherwise: Joi.optional()
    };
}

module.exports = {
    validate,
    getCustomStringJoi,
    getRequiredIfConditionIsTrue
};
