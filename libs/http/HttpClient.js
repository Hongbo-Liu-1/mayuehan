'use strict';

const HttpStatus = require('http-status-codes');
const joi = require('@hapi/joi');
const lodash = require('lodash');
const { oneLine } = require('common-tags');
const rp = require('request-promise');

const Attempt = require('../attempt/Attempt');
const CommandBuilder = require('../circuit-breaker/CommandBuilder');
const Log = require('../Log');
const ObjectUtils = require('../ObjectUtils');
const UnrecoverableException = require('../request-life-cycle/UnrecoverableException');

const HttpResponseException = require('./HttpResponseException');

const logger = Log.getLogger();

/**
 * @typedef {Object} HttpClient~Options
 * @property {!Array<!String>} [requestQueryParams] - the optional query parameters to request
 * @property {!String} [requestUsername] - the optional username to make the request
 * @property {!String} [requestPassword] - the optional password to make the request
 * @property {!Object} [requestBody] - the optional body to include in the request
 * @property {!Boolean} [json=true] - the option to indicate if both request and response body is in JSON
 * @property {!Number|!Array<!Number>} [responseHttpStatus] - the optional expected HTTP status of the response
 * @property {!Object<!Number, !SchemaLike>} [responseBodySchema] - the optional joi schema to validate the response
 *  body
 * @property {!Boolean} [fullResponse=true] - the option to indicate whether or not to return the full response
 *  instead of just the response body
 * @property {!Boolean} [undefinedIfNotFound=false] - the option to indicate whether or not to return undefined if
 *  response HTTP status is 404 NOT FOUND and fullResponse option is set to false
 * @property {!Boolean} [binaryResponse=false] - the option to indicate if the response body is in binary
 * @property {?String} [responseEncoding='utf8'] - the optional encoding to encode the response body
 * @property {!Number} [retryTimes=0] - the optional retry times
 * @property {!Number} [retryDelayMillis=1000] - the optional retry delay milliseconds
 * @property {!String} [commandName] - the option to protect the request with circuit breaker logic by commandName
 * @property {!CommandBuilder} [commandBuilder] - the commandBuilder object to wrap the request with circuit breaker
 */

/**
 *
 * @param {!String} requestMethod - the HTTP method to request
 * @param {!String} requestBaseUrl - the base URL to request
 * @param {!String} requestPath - the path to request
 * @param {!HttpClient~Options} [httpClientOptions] - the options
 * @returns {!Promise<!Object|!request.Response|undefined>} the promise containing the result of the request
 * @throws {MaxAttemptsExceededException} if the total number of attempts has exceeded the threshold
 * @throws {HttpResponseException} if the response body does not comply to the specified optional body schema
 */
function makeRequest(
    requestMethod,
    requestBaseUrl,
    requestPath,
    {
        requestQueryParams,
        requestUsername,
        requestPassword,
        requestBody,
        json = true,
        unrecoverableHttpStatus = [HttpStatus.BAD_REQUEST, HttpStatus.METHOD_NOT_ALLOWED, HttpStatus.UNPROCESSABLE_ENTITY],
        responseHttpStatus,
        responseBodySchema,
        fullResponse = true,
        undefinedIfNotFound = false,
        binaryResponse = false,
        responseEncoding = 'utf8',
        retryTimes = 0,
        retryDelayMillis = 1000,
        commandBuilder = CommandBuilder.defaultBuilder,
        commandName
    } = {}
) {
    return Attempt.execute(retryTimes, retryDelayMillis, async attemptInfo => {
        let response;
        try {
            const httpRequestBody = {
                method: requestMethod,
                baseUrl: requestBaseUrl,
                uri: requestPath,
                qs: requestQueryParams,
                auth: requestUsername !== undefined ? { user: requestUsername, pass: requestPassword } : undefined,
                body: requestBody,
                json,
                // Set to false to not throw exception if HTTP status is not 2xx
                simple: false,
                // Set to true to always return the complete response, then return accordingly after response has
                // been logged
                resolveWithFullResponse: true,
                encoding: binaryResponse ? null : responseEncoding
            };

            // We protect the HTTP request with circuit breaker logic if the commandName is passed as option variable
            if (commandName !== undefined && commandBuilder !== undefined) {
                const serviceCommand = commandBuilder.getOrCreateHystrixCommand(commandName, rp);
                response = await serviceCommand.execute(httpRequestBody);
            } else {
                response = await rp(httpRequestBody);
            }
        } catch (error) {
            // It is possible for the RequestError to include auth information if it was supplied when making the
            // request, hence masking it before it will be logged.
            const maskedError = ObjectUtils.maskSensitiveInfo(error);

            logger.error('Error encountered when making request', maskedError);
            return attemptInfo.doRetry(maskedError);
        }

        logger.debug(
            oneLine`HTTP request - ${response.request.host} - ${response.request.method} ${response.request.path}
                HTTP/${response.httpVersion} ${response.statusCode} ${response.message}`
        );
        logger.trace(`HTTP response body ${response.body instanceof Buffer ? '<Buffer>' : JSON.stringify(response.body)}`);

        if (unrecoverableHttpStatus !== undefined && lodash.concat([], unrecoverableHttpStatus).includes(response.statusCode)) {
            const errorMessage = `Response HTTP status ${response.statusCode} indicates an unrecoverable error`;
            logger.error(errorMessage);
            throw new UnrecoverableException(errorMessage, { errors: [response] });
        }

        // Normalize the responseHttpStatus
        if (responseHttpStatus !== undefined) {
            responseHttpStatus = lodash.concat([], responseHttpStatus);
        }

        if (!lodash.isEmpty(responseBodySchema)) {
            responseHttpStatus = lodash.union(
                lodash.defaultTo(responseHttpStatus, []),
                lodash.map(lodash.keys(responseBodySchema), Number)
            );
        }

        // The responseHttpStatus should be an array now if not undefined
        if (responseHttpStatus !== undefined && !responseHttpStatus.includes(response.statusCode)) {
            const errorMessage = `Expected HTTP status ${responseHttpStatus}, but got ${response.statusCode}`;
            logger.error(errorMessage);
            return attemptInfo.doRetry(new HttpResponseException(errorMessage));
        }

        let responseBody = response.body;

        if (responseBodySchema !== undefined && response.statusCode in responseBodySchema) {
            const validationResult = joi.validate(responseBody, joi.compile(responseBodySchema[response.statusCode]), {
                allowUnknown: true
            });

            if (validationResult.error) {
                // If the body does not comply to the schema, it is not worth retrying, hence throwing exception
                // instead of calling doRetry.
                throw new HttpResponseException('Response body does not comply to the specified schema', {
                    errorEntityName: 'responseBody',
                    errorEntity: responseBody,
                    cause: validationResult.error
                });
            } else {
                responseBody = validationResult.value;
            }
        }

        if (response.statusCode === HttpStatus.NOT_FOUND && undefinedIfNotFound) {
            responseBody = undefined;
        }

        return fullResponse && !binaryResponse ? response : responseBody;
    });
}

/**
 *
 * @param {!String} requestBaseUrl - the base URL to request
 * @param {!String} requestPath - the path to request
 * @param {!HttpClient~Options} [options] - the options
 * @returns {!Promise<!Object|!request.Response|undefined>} the promise containing the result of the request
 * @throws {MaxAttemptsExceededException} if the total number of attempts has exceeded the threshold
 * @throws {HttpResponseException} if the response body does not comply to the specified optional body schema
 */
function get(requestBaseUrl, requestPath, options = {}) {
    return makeRequest('GET', requestBaseUrl, requestPath, options);
}

/**
 *
 * @param {!String} requestBaseUrl - the base URL to request
 * @param {!String} requestPath - the path to request
 * @param {!Object} requestBody - the requestBody to post
 * @param {!HttpClient~Options} [options] - the options
 * @returns {!Promise<!Object|!request.Response|undefined>} the promise containing the result of the request
 * @throws {MaxAttemptsExceededException} if the total number of attempts has exceeded the threshold
 * @throws {HttpResponseException} if the response body does not comply to the specified optional body schema
 */
function post(requestBaseUrl, requestPath, requestBody, options = {}) {
    return makeRequest('POST', requestBaseUrl, requestPath, lodash.merge({ requestBody }, options));
}

/**
 *
 * @param {!String} requestBaseUrl - the base URL to request
 * @param {!String} requestPath - the path to request
 * @param {!Object} requestBody - the requestBody to put
 * @param {!HttpClient~Options} [options] - the options
 * @returns {!Promise<!Object|!request.Response|undefined>} the promise containing the result of the request
 * @throws {MaxAttemptsExceededException} if the total number of attempts has exceeded the threshold
 * @throws {HttpResponseException} if the response body does not comply to the specified optional body schema
 */
function put(requestBaseUrl, requestPath, requestBody, options = {}) {
    return makeRequest('PUT', requestBaseUrl, requestPath, lodash.merge({ requestBody }, options));
}

/**
 *
 * @param {!String} requestBaseUrl - the base URL to request
 * @param {!String} requestPath - the path to request
 * @param {!HttpClient~Options} [options] - the options
 * @returns {!Promise<!Object|!request.Response|undefined>} the promise containing the result of the request
 * @throws {MaxAttemptsExceededException} if the total number of attempts has exceeded the threshold
 * @throws {HttpResponseException} if the response body does not comply to the specified optional body schema
 */
function remove(requestBaseUrl, requestPath, options = {}) {
    return makeRequest('DELETE', requestBaseUrl, requestPath, options);
}

module.exports = {
    makeRequest,
    get,
    post,
    put,
    delete: remove /* eslint-disable-line quote-props */ // delete is a reserved word
};
