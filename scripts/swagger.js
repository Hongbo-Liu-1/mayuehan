#!/usr/bin/env node

'use strict';

const fs = require('fs-extra');
const jsYaml = require('js-yaml');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const yargs = require('yargs');

const pkg = require('../package');

const { argv } = yargs
    .usage(`Usage: ${path.basename(__filename)} [options]`)
    .option('inputPaths', {
        description: 'The list of paths from which to parse the API docs, node-glob supported',
        demand: true,
        type: 'array'
    })
    .option('outputPath', {
        description: 'The path to output the generate Swagger specification file',
        demand: true,
        type: 'string'
    });

// Using swagger-jsdoc to parse inline swagger definitions.
// Base swagger definition defined following https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md
const swaggerSpecObj = swaggerJsDoc({
    swaggerDefinition: {
        info: {
            title: pkg.name,
            description: pkg.description,
            version: pkg.version,
            contact: {
                name: pkg.author.name,
                url: pkg.homepage,
                email: pkg.author.email
            }
        },
        basePath: `/${pkg.shortName}`,
        schemes: ['http', 'https']
    },
    apis: argv.inputPaths
});

// It is possible to have empty object for some of the root-level fields in the generated swagger object.
// Remove all of them.
Object.keys(swaggerSpecObj).forEach(key => {
    if (Object.keys(swaggerSpecObj[key]).length === 0) {
        delete swaggerSpecObj[key];
    }
});

// Try to resolve if the given output path is a symlink
const outputPath = (() => {
    try {
        return fs.realpathSync(argv.outputPath);
    } catch (error) {
        return argv.outputPath;
    }
})();

// Output the content to the resolved output path
if (
    (fs.existsSync(outputPath) && fs.lstatSync(outputPath).isDirectory()) ||
    (outputPath.endsWith('/') || outputPath.endsWith(path.sep))
) {
    // This indicates a folder
    fs.outputFileSync(path.join(outputPath, 'swagger.yml'), jsYaml.dump(swaggerSpecObj));
} else {
    const ext = path.extname(outputPath);
    if (ext === '.json') {
        fs.outputFileSync(outputPath, JSON.stringify(swaggerSpecObj, null, 4));
    } else if (ext === '.yml' || ext === '.yaml') {
        fs.outputFileSync(outputPath, jsYaml.dump(swaggerSpecObj));
    } else {
        fs.outputFileSync(`${outputPath}.yml`, jsYaml.dump(swaggerSpecObj));
    }
}
