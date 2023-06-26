'use strict';

require('reflect-metadata');

// const express         = require('express');
// const path            = require('path')

const config          = require("./Config");
const pkg             = require("./package.json");
const { WebApp }      = require('./WebApp');

const { DbAccess }    = require('./src/DbAccess');
const Database        = require("./libs/database");
const ExitHandler     = require("./libs/ExitHandler");
const Log             = require('./libs/Log');
const ObjectUtils     = require("./libs/ObjectUtils");


const logger = Log.getLogger();

async function main() {
  logger.info('Starting 2019 Tsinghua North American Alumni Ma Yuehan Cup\n\n');
  logger.debug('Configurations loaded: ', JSON.stringify(ObjectUtils.maskSensitiveInfo(config)));

  ExitHandler.initialize(pkg.name);
  ExitHandler.cleanUpLastWith(Log.terminate);

  const database = new Database(config);
  const dbAccess = new DbAccess(config, database);

  const webApp = new WebApp(config.webApp, dbAccess);
  ExitHandler.cleanUpWith(() => {
    logger.info('Stopping Web App Service');
    webApp.stop();
    logger.info('Stopped Web App Service');
  });

  webApp.start();
  logger.info('Instantiated/Activated Web App Service');

  /*
  let app = express()
    .use(express.static(path.join(__dirname, 'public')))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs');

  app.get('/', (req, res) => res.render('pages/index'));

  //let database = "";
  //let reg = new Reg(database, app);

  app.listen(5000, () => console.log(`Listening on 5000`));
  */
}

if (require.main === module) {
  main();
}

