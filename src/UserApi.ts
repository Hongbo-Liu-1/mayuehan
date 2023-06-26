'use strict';

import * as passport from 'passport';
// import * as passportLocal from "passport-local";
import * as util from 'util';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { userInfo } from 'os';

// const LocalStrategy = passportLocal.Strategy;
const logger = Log.getLogger();

export class UserApi {
    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess, express) {
        this.dbAccess = dbAccess;

        express.get('/', (req, res) => {
            if (req.user.password) {
                if (req.session.backUrl) {
                    const backUrl = req.session.backUrl;
                    delete req.session.backUrl;
                    res.redirect(backUrl);
                } else {
                    res.render('pages/index', { user: req.user });
                }
            } else {
                const results = new Result(0, undefined, req.user);
                res.render('pages/profile', { user: req.user, results });
            }
        });

        express.post('/user/login',
            passport.authenticate('local', 
            { 
                successRedirect: '/',
                failureRedirect: '/user/login',
                failureFlash: true 
            })
        );

        express.get('/user/login', (req, res) => {
            res.render('pages/login', { message: req.flash() });
        });

        express.get('/user/logout', (req, res) => {
            req.logout();
            res.redirect('/');
        });

        express.get('/user/profile', async (req, res) => {
            const results = new Result(0, undefined, req.user);
            res.render('pages/profile', { user: req.user, results });
        });

        express.get('/user/profile/:userId', async (req, res) => {
            const results = await Result.wrap(async () => {
                this.checkPermission(req, req.params.userId);
                return await this.dbAccess.queryUserById(req.params.userId);
            });
            res.render('pages/profile', { user: req.user, results });
        });

        express.post('/user/password/:userId', async (req, res) => {
            const results = await Result.wrap(async () => {
                await this.updatePassword(req);
                return await this.dbAccess.queryUserById(req.params.userId);
            });
            if (results.status == 0) {
                results.message = "Password had been updated successfully !"
            }
            res.render('pages/profile', { user: req.user, results });
            /*
            // Old jQuery way
            try {
                const data = await this.updatePassword(req);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
            */
        });
    }

    private checkPermission(req, userId) {
        if (req.user.user_type === 'guest' || (req.user.user_type === 'admin' && userId != req.user.id)) {
            throw new Exception('No permission !')
        }
    }

    /**
     * 
     * @param req - { userId, password }
     */
    private async updatePassword(req) {
        logger.debug('Update password for user: ' + req.user.user_name);

        if (isNaN(req.params.userId) || req.params.userId != req.body.id) {
            throw new Exception('Invalid parameter !')
        }

        this.checkPermission(req, req.params.userId);

        const password: string = req.body.password ? req.body.password.trim() : undefined;
        if (!password || password.length < 8) {
            throw new Exception('Invalid password !');
        }

        const users: Table.User[] = await this.dbAccess.query('SELECT * FROM user_detail WHERE id = $1', req.body.id);
        if (!users || users.length < 1) {
            throw new Exception('Cannot find the user !');
        }

        const hash = Table.User.sha256(password);
        return await this.dbAccess.query(
            'UPDATE user_detail SET password = $1 WHERE id = $2',
            [hash, req.body.id]
        );
    }


}