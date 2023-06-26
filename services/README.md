# TOC #
* [Services](#Services)
* [Implementation](#Implementation)
  * [Discovering a Service](#Discovering-a-Service)
    * [Discovery by Class](#Discovery-by-Class)
      * [As a Dependency, as a Constructor Argument](#As-a-Dependency-as-a-Constructor-Argument)
      * [On the Fly](#On-the-Fly)
    * [Discovery by Identifier](#Discovery-by-Identifier)
  * [Managing the Lifetime](#Managing-the-Lifetime)
    * [Object Creation and Activation](#Object-Creation-and-Activation)
      * [Asynchronous Activation](Asynchronous-Activation)
    * [Object Clean-up](#Object-Clean-up)
  * [Defining the Scope](#Defining-the-Scope)
  * [Reporting Meaningful Metrics](#Reporting-Meaningful-Metrics)
  * [Reporting on Health](#Reporting-on-Health)

# Services #
In this application, a service "does one thing well" and:
1. Is discoverable by other services, so that application functionality can be composed,
1. Has a managed lifetime,
1. Has a defined scope (transient? singleton? per API request?)
1. Reports meaningful metrics concerning its operation,
1. Reports on its health and the health of its dependencies through the API.

# Implementation #
For the first three items above, [Wikipedia - Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) and an exit handler are used together.

For dependency injection, inversify is used:
> A powerful and lightweight inversion of control container for JavaScript & Node.js apps powered by TypeScript.

See [npm inversify](https://www.npmjs.com/package/inversify)

A DI container provided by inversify:
* Allows a service to be looked up,
* Will create the service if required, as well as any of its needed dependencies, their dependencies, and so on,
* Will enforce a scope the looked up service.

For exit handling, `./libs/ExitHandler` is used. It is available as a discoverable service through the DI container and allows other services to specify functions that should be run when the application is exiting.

Details are provided below.

## Discovering a Service ##
Depending on the nature of a service, it can be made discoverable as a class, or using an identifier. Below the metrics collector ('./libs/metrics/metricsCollector') and validated configuration ('./Config') are used as an example of either.

### Discovery by Class ###
A service represented by a class can be looked up:
* As dependency of any other service managed by the DI container, and specified as a constructor argument, or
* On the fly

#### As a Dependency, as a Constructor Argument ####
If the service with the dependency is managed by the DI container, and the dependency is specified as a constructor arg, it is enough to annotate the dependency:

The annotation is done in-line in TypeScript:
```typescript
import { ..., inject } from "inversify";

// Assuming an index.d.ts has been set-up
import { MetricsCollector } from '../libs/metrics';

export class MyTypeScriptService {
    public constructor(
        ...,
        @inject(MetricsCollector) metricsCollector: MetricsCollector,
        ... }) {
```

In javascript, annotating is a little less pretty:
```javascript
const inversify = require('inversify');
const { MetricsCollector } = require('../libs/metrics/metricsCollector');

class MyJavaScriptService {
    /**
     *
     * @param ...
     * @param {!MetricsCollector} metricsCollector
     * @param ...
     */
    constructor(..., metricsCollector, ... }) {
    ...
};

module.exports = { MyJavaScriptService };

// Make resolvable and injectable to other classes
inversify.decorate(inversify.injectable(), MyJavaScriptService);

// Make it possible to inject constructor args
// Parm 0:
...
// Parm 1:
inversify.decorate(inversify.inject(MetricsCollector), module.exports.MyJavaScriptService, 1);
...
```

#### On the Fly ####
Here, the DI container can be brought in and the dependency looked up on the fly. The DI container will ensure that the dependency is created with the correct scope (described in following sections).

```typescript

import { container } from '../di-composable-root';

// Assuming an index.d.ts has been set-up
import { MetricsCollector } from '../libs/metrics';

...

const metricsCollector: MetricsCollector = container.get(MetricsCollector);
```

```javascript
const { container } = require('../di-composable-root');
const { MetricsCollector } = require('../libs/metrics/metricsCollector');

...

const metricsCollector = container.get(MetricsCollector);

```

### Discovery by Identifier ###
To obtain an instance of a service by identifier, an identifier needs to be created. This is done in a file used specifically for the service, e.g. './service/ConfigService.ts', also used for other purposes to be shown later:
```typescript
'use strict';

...

/**
 * Symbol to use for resolving the validated config object from the DI container.
 */
export const DI_CONFIG = Symbol.for('DI_CONFIG');
```


Then looking up the service on the fly is as simple as:

```typescript
import { DI_CONFIG } from '../services/ConfigService';
import { container } from '../di-composable-root';
...

export class MyTypeScriptService {
    // as a dependency...
    public constructor(
        ...,
        @inject(DI_CONFIG) config: any,
        ... }) {
...
    // ...or on the fly
    const config: any = container.get(DI_CONFIG);
```

or:
```javascript
const { DI_CONFIG } = require('../services/ConfigService');
const { container } = require('../di-composable-root');

class MyJavaScriptService {
    /**
     *
     * @param ...
     * @param config
     * @param ...
     */
    // as a dependency...
    constructor(..., config, ... }) {
    ...

// Parm 2:
inversify.decorate(inversify.inject(DI_CONFIG), module.exports.MyJavaScriptService, 2);
...
    // ...or on the fly
    const config = container.get(DI_CONFIG);
```

## Managing the Lifetime ##
### Object Creation and Activation ###
Object creation and activation is managed by the DI container. In order to inform the DI container how to instantiate and activate the service, a bind is done.

In 'main.js'
```javascript
const { container } = require('./di-composable-root');
```

In 'di-composable-root.ts'
```typescript

import { Container } from 'inversify';
import { configServiceBind } from './services/ConfigService';
import { metricsCollectorBind } from './libs/metrics/MetricsCollectorService';

export var container = new Container();

configServiceBind(container);
metricsCollectorBind(container);
...
```
and then in './services/ConfigService.ts' and './libs/metrics/MetricsCollectorService.ts' respectively:
```typescript
import { Container } from 'inversify';

export function configServiceBind(container: Container) {
    container
        .bind<any>(DI_CONFIG)
        // Using .toDynamicValue().inSingletonScope() so cached and only activated once.
        // .toConstant() seems to activate multiple times
        .toDynamicValue(context => {
            logger.info('Instantiating validated configuration Service');
            return config;
        })
        ...
        .onActivation((context, config) => {
            logger.info('Activating validated configuration Service');
            logger.debug('Configurations loaded: ', JSON.stringify(ObjectUtils.maskSensitiveInfo(config)));
            logger.info('Activated validated configuration Service');
            return config;
        });
```

```typescript
import { Container } from 'inversify';
import { MetricsCollector } from '../libs/metrics/metricsCollector';

export function metricsCollectorBind(container: Container) {
    // enforce a singleton MetricsCollector, and activate it for node v10 process
    container
        .bind<MetricsCollector>(MetricsCollector)
        .toSelf()
        ...
        .onActivation((context, metricsCollector) => {
            logger.info('Instantiating/Activating Metrics Collector Service');
            // get the config...
            const config: any = container.get(DI_CONFIG);

            // ...then set the process-specific info...
            metricsCollector.setStaticMetadata(`{${pkg.name}Version`, pkg.version);

            // Speed things up during testing - TGB, June 26, 2019
            // TODO: Remove when deployed to cloud
            const awsEc2IdentityDocument = await AwsEc2IdentityDocument.get();
            const region = config.region || awsEc2IdentityDocument.region;
            const instanceId = awsEc2IdentityDocument.instanceId || uuid();

            metricsCollector.setStaticDimension('region', region);
            metricsCollector.setStaticDimension('instanceId', instanceId);
            metricsCollector.setStaticDimension('instanceRole', pkg.name);

            // ...and then complete the activation.
            activateMetricsCollector(metricsCollector, container.get(ExitHandler));

            logger.info('Instantiated/Activated Metrics Collector Service');
            return metricsCollector;
        });
```
#### Asynchronous Activation ####
Sometimes starting a service requires waiting for something else. The asynchronous start can be buried in a synchronous start by having the synchronous
start trigger a defer promise chain. Use of the service's API can wait on the promise that depends on the successful completion of asynchronous start-up if
needed. These need to be async functions. The following illustrates:
```javascript
class MyService {
  constructor(
      ...
  ) {
      ...
    // Use this defer to trigger asynchronous start-up later, synchronously
    this._triggerStart = Promise.defer();
    // Create a promise that waits on the start trigger,
    // and then waits for starting to be completed.
    this._hasStarted = (async () => {
      await this._triggerStart.promise;
      await this._startAsync();
    })();
  };

  // Synchronous start
  start() {
    // trigger start
    this._triggerStart.resolve(null);
  };

  async _startAsync() {
    logger.info("Starting MyService!");

    await ...;

    logger.info("STARTED MyService!");
    return null;
  };

  /**
   * An example of an API that depends on successful start
   */
  async api(request) {
    await this._hasStarted;

    // Now do something with request...
    const response = ...(request, ...);
    return response;
  };
};
```
Starting is done as shown before by the DI container.

If it is desired to retry failed starts, then the './libs/attemptAttempt' module could be used. Then
```javascript
    // Create a promise that waits on the start trigger,
    // and then waits for starting to be completed.
    this._hasStarted = (async () => {
      await this._triggerStart.promise;
      await this._startAsync();
    })();
```
becomes:
```javascript
    // Create a promise that waits on the start trigger,
    // and then waits for starting to be completed successfully.
    this._hasStarted = (async () => {
      await this._triggerStart.promise;
      await Attempt.execute(START_UP_RETRY_TIMES, START_UP_RETRY_DELAY_MILLIS, this._startAsync);
    })();
```

Note: a `stop()` function can be made to replace `this.hasStarted` with a rejected promise (e.g. "Shutting down"?) before it does the necessary work to do stop.

### Object Clean-up ###
Object clean-up is taken care of by a service `ExitHandler` that is also available from the container. `ExitHandler` can be made to run functions when the application is shutting down. `ExitHandler` itself determines when the application is shutting down. A service usually specifies what actions need to be run on shutdown at the same time it is activating itself. For example, from './services/WebAppService.ts':
```typescript
export function webAppBind(container: Container) {
    container
        .bind<WebApp>(WebApp)
        .toSelf()
        ...
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
```
## Defining the Scope ##
The container can be used to determine the lifetime scope of the objects it constructs. Normally objects are created with transient scope, that is, a unique instance for every request, but can also be created with singleton or request scope. This is done during the bind:

```typescript
export function metricsCollectorBind(container: Container) {
    // enforce a singleton MetricsCollector, and activate it for node v10 process
    container
        .bind<MetricsCollector>(MetricsCollector)
        .toSelf()
        .inSingletonScope() // <<<<< scope definition
        .onActivation((context, metricsCollector) => {
        ...
```

```typescript
export function configServiceBind(container: Container) {
    container
        .bind<any>(DI_CONFIG)
        // Using .toDynamicValue().inSingletonScope() so cached and only activated once.
        // .toConstant() seems to activate multiple times
        .toDynamicValue(context => {
            logger.info('Instantiating validated configuration Service');
            return config;
        })
        .inSingletonScope() // <<<<< scope definition
        .onActivation((context, config) => {
        ...
```
## Reporting Meaningful Metrics ##
Meaningful metrics are reported using the MetricsCollector instance provided as a service through the DI container. The collector is used to get the metric by name (defined in './metrics.json') and then manipulate it. Here is an example from mssqlsupport.ts:
```typescript
        } else {
            var that = this;
            this.metricsCollector.getMetric(METRIC_OUTGOING_GIM_CONNECTIONWAIT).start(undefined, { dbType: 'mssql' });
            var retPomise = this.gimDbConnection.pool.connect();
            this.gimDbConnection.connectingPromise = retPomise;
            return retPomise
                .then(function(dbConn: any) {
                    that.metricsCollector
                        .getMetric(METRIC_OUTGOING_GIM_CONNECTIONWAIT)
                        .stop(undefined, { dbType: 'mssql', result: 'success' });
                    return dbConn;
                })
                .catch(function(err: any) {
                    that.metricsCollector
                        .getMetric(METRIC_OUTGOING_GIM_CONNECTIONWAIT)
                        .stop(undefined, { dbType: 'mssql', result: 'failure' });
                    throw err;
                });
        }
```
See './libs/metrics/README.md' for details.

## Reporting on Health ##
More needs to be written in here when known - TGB, July 2, 2019
