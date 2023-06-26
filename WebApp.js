'use strict';

const bluebird = require('bluebird');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash=require("connect-flash");
const errorHandler = require('errorhandler');
const express = require('express');
const session = require('express-session');
const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const HttpStatus = require('http-status-codes');
const methodOverride = require('method-override');
const morgan = require('morgan');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path')
const splitCa = require('split-ca');

const Log = require('./libs/Log');

const Controllers = require('./controllers');
const Table = require("./model/Table");
const { PointApi } = require('./src/PointApi');
const { RegApi } = require('./src/RegApi');
const { TeamApi } = require('./src/TeamApi');
const { UserApi } = require('./src/UserApi');

const logger = Log.getLogger();

class WebApp {
    /**
     *
     * @param {!Object} config
     * @param {!DbAccess} dbAccess
     */
    constructor(config, dbAccess) {

        logger.debug('\n\n\nWebApp Configurations: ', JSON.stringify(config));

        this.config = config;
        this.dbAccess = dbAccess;
        this.express = express();

        passport.serializeUser((user, done) => {
            done(undefined, user.id);
          });
          
        passport.deserializeUser((id, done) => {
            this.dbAccess.queryUserById(id)
            .then(user => {
                if (!user) {
                    return done(null, false);
                }
                return done(null, user);
            }).catch (err => {
                return done(err);
            });
        });
        
        passport.use(
            new LocalStrategy((username, password, done) => {
                this.dbAccess.queryUserByName(username)
                .then(user => {
                    if (!user) {
                        return done(null, false);   // fail
                    }

                    // verify password - no password is ok
                    const p = Table.User.sha256(password);
                    if (user.password && user.password !== p) {
                        return done(null, false);   // fail
                    }
                    
                    return done(null, user);    // succ
                }).catch (err => {
                    return done(err);
                });
            })
        );


        /**
         * Setup request method override
         *
         * Allow overriding HTTP method via the X-HTTP-Method-Override header via the POST request.
         */
        this.express.use(methodOverride('X-HTTP-Method-Override', { methods: ['POST'] }));

        /**
         * Setup request body parsing
         */
        this.express.use(
            bodyParser.json({ limit: this.config.bodyLimit.json }),
            bodyParser.text({ limit: this.config.bodyLimit.text }),
            bodyParser.urlencoded({ extended: true, limit: this.config.bodyLimit.urlencoded }),
            bodyParser.raw({ limit: this.config.bodyLimit.raw })
        );

        /**
         * Setup request error handler, enabled for development only
         */
        if (process.env.NODE_ENV === 'development') {
            this.express.use(
                errorHandler({
                    log: (error, string, request) => {
                        logger.error(`Error in request ${request.method} ${request.url}: ${string}.`, error);
                    }
                })
            );
        }

        /**
         * Setup request-response logging
         */
        const requestLogger = Log.getLogger('request');
        this.express.use(
            morgan('short', {
                stream: {
                    write: string => {
                        requestLogger.info(string.trim());
                    }
                }
            })
        );

        this.express.use(cookieParser());

        this.express.use(session({ 
            cookie: { maxAge: 86400000 }, // 1d
            secret: 'tsinghua',
            resave: true, 
            saveUninitialized: true
        }));

        this.express.use(passport.initialize());
        this.express.use(passport.session());
        this.express.use(flash());

        const ensureAuthenticated = (req, res, next) => {
            if (req.isAuthenticated() || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/user/login') {
                return next();
            } else {
                req.session.backUrl = req.path;
                res.redirect('/user/login');
            }
        };
        this.express.use(ensureAuthenticated);

        /**
         * Disallow the cache of the response.
         */
        this.express.use((request, response, next) => {
            response.set('Cache-Control', 'private, no-cache, no-store, max-age=0'); // HTTP 1.1
            response.set('Pragma', 'no-cache'); // HTTP 1.0
            response.set('Expires', '0'); // Proxies
            next();
        });

        /**
         * Setup routes
         */
        this.express
            .use(express.static(path.join(__dirname, 'public')))
            .set('views', path.join(__dirname, 'views'))
            .set('view engine', 'ejs');

        new UserApi(dbAccess, this.express);
        new PointApi(dbAccess, this.express);
        new RegApi(dbAccess, this.express);
        new TeamApi(dbAccess, this.express);

        const controllers = Controllers.getControllers({
            activeVersionRouteOptions: { database: dbAccess.database }
        });

        this.express.use(`/info`, controllers);

        // Fallback to HTTP Not Found for all unknown paths
        this.express.all('*', (request, response) => {
            response.sendStatus(HttpStatus.NOT_FOUND);
        });

        // Configure http/https servers
        this.http = this.config.http.enable ? http.createServer(this.express) : undefined;
        this.https = this.config.https.enable
            ? https.createServer(
                  {
                      cert: fs.readFileSync(this.config.https.publicKeyPath),
                      key: fs.readFileSync(this.config.https.privateKeyPath),
                      passphrase: this.config.https.privateKeyPassword,
                      ca: this.config.https.caBundlePath ? splitCa(this.config.https.caBundlePath) : this.config.https.caBundlePath
                  },
                  this.express
              )
            : undefined;

        if (!this.config.http.enable && !this.config.https.enable) {
            logger.warn('Both http and https are disabled');
        }
    }

    start() {
        const port = process.env.PORT || this.config.http.port;
        if (this.http && !this.http.listening) {
            this.http.listen(port, () => {
                logger.info(`HTTP server listening on port: ${port}`);
            });
        }
/*
        if (this.https && !this.https.listening) {
            this.https.listen(this.config.https.port, () => {
                logger.info(`HTTPS server listening on port: ${this.config.https.port}`);
            });
        }
*/
    }

    /**
     *
     * @returns {!bluebird}
     */
    stop() {
        const promises = [];

        if (this.http) {
            promises.push(
                bluebird
                    .promisify(this.http.close)()
                    .catch(error => {
                        logger.error('Error when terminating HTTP server.', error);
                    })
                    .finally(() => {
                        this.http = undefined;
                    })
            );
        }

        if (this.https) {
            promises.push(
                bluebird
                    .promisify(this.https.close)()
                    .catch(error => {
                        logger.error('Error when terminating HTTPS server.', error);
                    })
                    .finally(() => {
                        this.https = undefined;
                    })
            );
        }

        return bluebird.all(promises);
    }
}

module.exports = { WebApp };
