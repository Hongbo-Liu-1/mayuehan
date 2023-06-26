'use strict';

import * as util from 'util';

import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';

const logger = Log.getLogger();

export class PointApi {
    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess, express) {
        this.dbAccess = dbAccess;

        express.get('/point/players', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.dbAccess.queryPlayers(undefined, undefined, undefined, undefined, req.query.orderBy);
            });
            res.render('pages/players', { user: req.user, results });
        });

        express.get('/point/player/:id', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.getPlayer(req.params.id);
            });
            res.render('pages/player', { user: req.user, results });
        });

        express.get('/point/departments', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.dbAccess.queryDepartments(req.query.orderBy);
            });
            res.render('pages/departments', { user: req.user, results });
        });

        express.get('/point/department/:id', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.getDepartment(req.params.id, req.query.orderBy);
            });
            res.render('pages/department', { user: req.user, results });
        });

        express.get('/point/associations', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.dbAccess.queryAssociations(req.query.orderBy);
            });
            res.render('pages/associations', { user: req.user, results });
        });

        express.get('/point/association/:id', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.getAssociation(req.params.id, req.query.orderBy);
            });
            res.render('pages/association', { user: req.user, results });
        });

        express.get('/point/calc', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.calc();
            });
            res.render('pages/calc', { user: req.user, results });
        });

        express.post('/point/onlineRunJoin', async (req, res) => {
            try {
                const data = await this.postAssociationOnlineRunJoin(req.body);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
        });

        express.post('/point/onlineRunRank', async (req, res) => {
            try {
                const data = await this.postAssociationOnlineRunRank(req.body);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
        });

    }

    private async getPlayer(id) {
        const players = await this.dbAccess.queryPlayers(undefined, undefined, id);
        const teams = await this.dbAccess.queryTeams(undefined, undefined, undefined, id);
        return { player: players[0], teams };
    }

    private async getDepartment(id, orderBy) {
        const departments = await this.dbAccess.query('SELECT * FROM th_department WHERE id = $1', [id]);
        const players = await this.dbAccess.queryPlayers(id, undefined, undefined, undefined, orderBy);
        return { department: departments[0], players };
    }

    private async getAssociation(id, orderBy) {
        const associations = await this.dbAccess.query('SELECT * FROM th_association WHERE id = $1', [id]);
        const players = await this.dbAccess.queryPlayers(undefined, id, undefined, undefined, orderBy);
        return { association: associations[0], players };
    }

    private numOrNull(s) {
        return s ? (isNaN(s) ? null : s) : null;
    }

    /**
     * 
     * @param body - { associationId, onlineRunJoin }
     */
    private async postAssociationOnlineRunJoin(body) {
        logger.debug('Post association online run join');
        if (!isNaN(body.associationId)) {
            return await this.dbAccess.query(
                'UPDATE th_association SET online_run_join = $1 WHERE id = $2',
                [body.onlineRunJoin, body.associationId]
            );
        }
    }


    /**
     * 
     * @param body - { associationId, onlineRunRank }
     */
    private async postAssociationOnlineRunRank(body) {
        logger.debug('Post association online run rank');
        if (!isNaN(body.associationId)) {
            const onlineRunRank = this.numOrNull(body.onlineRunRank);
            return await this.dbAccess.query(
                'UPDATE th_association SET online_run_rank = $1 WHERE id = $2',
                [onlineRunRank, body.associationId]
            );
        }
    }


    private countTeamsForEvent(teams, events) {
        const eventIdToTeamNumMap = {};
        events.forEach(e => {
            eventIdToTeamNumMap[e.id] = 0;
        });
        teams.forEach(e => {
            eventIdToTeamNumMap[e.event_id] += 1;
        })
        return eventIdToTeamNumMap;
    }

    private calcPointsForAssociation(a: Table.Association) {
        const H = 40; // highest points

        if (a.online_run_rank && a.online_run_rank > 0 && a.online_run_rank < 9) {
            a.online_run_points = a.online_run_rank == 1 ? H : (H - a.online_run_rank * 4);
        } else if (a.online_run_join) {
            a.online_run_points = 4;
        } else {
            a.online_run_points = 0;
        }
    }

    private calcPointsForTeam(team: Table.Team, eventIdToTeamNumMap) {
        const N = eventIdToTeamNumMap[team.event_id];

        let rate = 1;
        if (N > 16) {
            rate = 1.1;
        }
        if (N > 24) {
            rate = 1.2;
        }

        let H = 10; // highest points
        if (N <= 8) {
            H = N + 1;
        }

        team.points = 0;
        if (team.rank && team.rank > 0 && team.rank < 9 && team.rank < N) {
            const points = team.rank == 1 ? H : (H - team.rank);
            team.points = points * rate;
            team.note = util.format("N = %d, Rate = %d, Points = %d * %d", N, rate, points, rate);
        } else {
            // if (team.sport_id != 1 || team.event_id <= 12) {
            team.points = 1;
            team.note = null;
            // }
        }
    }

    private async calc() {
        // 0. read players/departments/associations/teams and reset all points to 0
        const players = await this.dbAccess.queryTable('player');
        const assocs: Table.Association[] = await this.dbAccess.queryTable('th_association');
        const depts = await this.dbAccess.queryTable('th_department');
        const teams = await this.dbAccess.queryTeams();
        const events = await this.dbAccess.querySportEvents();

        assocs.forEach(a => {
            this.calcPointsForAssociation(a);
        });

        players.forEach(e => { e.points = 0 });
        assocs.forEach(e => { e.points = e.online_run_points });
        depts.forEach(e => { e.points = 0 });

        const eventIdToTeamNumMap = this.countTeamsForEvent(teams, events);

        // 1. calc points for each team
        teams.forEach(t => {
            this.calcPointsForTeam(t, eventIdToTeamNumMap);
            t.players.forEach(tp => {
                const p = players.find(x => x.id == tp.player_id);
                p.points += t.points;
            });
        });

        // 2. spread to player/department/associations
        players.forEach(p => {
            if (p.th_department_id) {
                const d = depts.find(x => x.id == p.th_department_id);
                d.points += p.points;
            }
            if (p.th_association_id) {
                const a = assocs.find(x => x.id == p.th_association_id);
                a.points += p.points;
            }
        })

        // 3. Update tables
        await this.updatePointsAndNote('team', teams);
        await this.updatePoints('player', players);
        await this.updatePointsAndOnlineRunPoints('th_association', assocs);
        await this.updatePoints('th_department', depts);

        return new Result(0, "积分已经重新计算。", undefined);
    }

    private async updatePoints(tableName: string, list: any[]) {
        const values = list.map(p => {
            return util.format("(%d, %d)", p.id, p.points);
        });

        const sql = util.format(
            `UPDATE %s AS p
                SET
                    points = v.points
                FROM (
                    VALUES
                        %s
                    ) AS v (id, points)
                WHERE p.id = v.id`,
            tableName, values);

        await this.dbAccess.query(sql);
    }
    private async updatePointsAndOnlineRunPoints(tableName: string, list: Table.Association[]) {
        const values = list.map(p => {
            return util.format("(%d, %d, %d)", p.id, p.points, p.online_run_points);
        });

        const sql = util.format(
            `UPDATE %s AS p
                SET
                    points = v.points,
                    online_run_points = v.online_run_points
                FROM (
                    VALUES
                        %s
                    ) AS v (id, points, online_run_points)
                WHERE p.id = v.id`,
            tableName, values);

        await this.dbAccess.query(sql);
    }

    private async updatePointsAndNote(tableName: string, list: any[]) {
        const values = list.map(p => {
            return util.format("(%d, %d, '%s')", p.id, p.points, p.note || '');
        });

        const sql = util.format(
            `UPDATE %s AS p
                SET
                    points = v.points,
                    note = v.note
                FROM (
                    VALUES
                        %s
                    ) AS v (id, points, note)
                WHERE p.id = v.id`,
            tableName, values);

        await this.dbAccess.query(sql);
    }
}