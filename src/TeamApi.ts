'use strict';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { X_OK } from 'constants';

const logger = Log.getLogger();

export class TeamApi {
    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess, express) {
        this.dbAccess = dbAccess;

        express.get('/players/:sportId', async (req, res) => {
            const results = await Result.wrap(async () => {
                const players = await this.dbAccess.queryPlayers(undefined, undefined, undefined, req.params.sportId, req.query.orderBy);
                const events = await this.dbAccess.querySportEvents(req.params.sportId); // for nav
                const event = events[0];
                return { events, event, players };
            });
            res.render('pages/playersPerSport', { user: req.user, results });
        });


        express.get('/teams/:sportId/:eventId', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.getTeams(req.params.sportId, req.params.eventId, req.query.orderBy);
            });
            res.render('pages/teams', { user: req.user, results });
        });


        express.get('/team/:sportId/:eventId/:teamId', async (req, res) => {
            const results = await Result.wrap(async () => {
                return await this.getTeam(req.params.sportId, req.params.eventId, req.params.teamId);
            });
            res.render('pages/team', { user: req.user, results });
        });

        express.post('/team/:sportId/:eventId/:teamId', async (req, res) => {
            const results = await Result.wrap(async () => {
                if (!Table.User.hasPermission(req.user, req.params.sportId)) {
                    throw new Exception("No permission !")
                }
                const r = await this.postTeam(req.params.sportId, req.params.eventId, req.params.teamId, req.body);
                const t = await this.getTeams(req.params.sportId, req.params.eventId, req.query.orderBy);
                if (r instanceof Result) {
                    r.data = t;
                    return r;
                } else {
                    return t;
                }
            });
            // res.render('pages/teamr', { user: req.user, results });
            res.render('pages/teams', { user: req.user, results });
        });

        express.post('/team/rank', async (req, res) => {
            try {
                const data = await this.postTeamRank(req.body);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
        });

        express.post('/team/teamName', async (req, res) => {
            try {
                const data = await this.postTeamName(req.body);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
        });

        express.post('/team/player', async (req, res) => {
            try {
                const data = await this.postTeamPlayer(req.body);
                return res.type('application/json').send(data);
            } catch (e) {
                logger.error("Internal Error", e);
                return res.sendStatus(500);
            };
        });
    }

    private async postTeam(sportId, eventId, teamId, body) {
        if (body.delete) {
            return await this.deleteTeam(sportId, eventId, teamId);
        } else {
            const events = await this.dbAccess.querySportEvents(sportId, eventId);
            const event: Table.SportEvent = events[0];
            // const players: Table.Player[] = await this.dbAccess.query('SELECT * FROM player WHERE sport_id = $1', [sportId]);
            const players: Table.Player[] = await this.dbAccess.queryTable('player');
            // create or update team
            const teamInForm = new Table.Team(sportId, eventId, []);
            if (body.teamName && body.teamName.trim() != '') {
                teamInForm.team_name = body.teamName.trim();
            }
            if (body.rank && body.rank.trim() != '') {
                teamInForm.rank = body.rank.trim();
            }
            for (let i = 0; i < event.team_size; i++) {
                const playerIdField = 'playerId-' + i;
                if (body[playerIdField] && body[playerIdField] !== '-1') {
                    const p = Table.Player.getPlayerById(players, body[playerIdField]);
                    if (!p) {
                        return new Result(500, "Failed to find player for id:" + body[playerIdField], {});
                    }
                    teamInForm.addPlayer(p);
                }
            }
            if (teamInForm.players.length == 0) {
                if (teamId.toLowerCase() == 'new') {
                    return new Result(400, "至少需要一个队员.", {});
                } else {
                    return await this.deleteTeam(sportId, eventId, teamId);
                }
            }

            if (teamId.toLowerCase() == 'new') {
                await this.dbAccess.insertNewTeams([teamInForm]);
                await this.dbAccess.insertNewTeamPlayers([teamInForm]);
                const data = await this.getTeam(sportId, eventId, teamInForm.id);
                return new Result(0, "此队伍已经成功创建.", data);
            } else {
                const teams = await this.dbAccess.queryTeams(sportId, eventId, teamId);
                const team = teams[0];
                // update team info
                if (teamInForm.team_name != team.team_name || teamInForm.rank != team.rank) {
                    await this.dbAccess.query(
                        "UPDATE team SET team_name = $1, rank = $2 WHERE id = $3",
                        [teamInForm.team_name, teamInForm.rank, teamId]);
                }
                // remove old team players
                team.players.forEach(async tp => {
                    if (! teamInForm.players.find(x => x.player_id == tp.player_id)) {
                        await this.dbAccess.query("DELETE FROM team_player WHERE team_id = $1 AND player_id = $2", [teamId, tp.player_id]);
                    }
                });
                // add new team players
                const newTeamPlayers = [];
                teamInForm.players.forEach(tp => {
                    if (! team.players.find(x => x.player_id == tp.player_id)) {
                        newTeamPlayers.push(tp);
                    }
                });
                if (newTeamPlayers.length > 0) {
                    team.players = newTeamPlayers;
                    await this.dbAccess.insertNewTeamPlayers([team]);
                }
                const data = await this.getTeam(sportId, eventId, teamId);
                return new Result(0, "此队伍已经成功修改.", data);
            }
        }
    }

    private async deleteTeam(sportId, eventId, teamId) {
        const data = await this.getTeam(sportId, eventId, teamId);

        await this.dbAccess.query("DELETE FROM team_player WHERE team_id = $1", [teamId]);
        await this.dbAccess.query("DELETE FROM team WHERE id = $1", [teamId]);

        return new Result(0, "此队伍已经成功删除。", data);
    }

    /**
     * Add player to team. If body.id start with "Unknow", create the team first.
     * @param body - { teamId, playerName, sportId, eventId}
     *   - when teamId is 'Unknown*', need to create new team
     * @returns - { teamId, playerId }
     */
    private async postTeamPlayer(body) {
        logger.debug('Post team player');

        const players: Table.Player[] = await this.dbAccess.queryTable('player');
        const p: Table.Player = Table.Player.findPlayer(body.playerName, players);
        const tp = new Table.TeamPlayer(undefined, p, -1); // new team player
        const team = new Table.Team(body.sportId, body.eventId, [tp]);

        team.id = body.teamId;
        if (body.teamId.startsWith("Unknow")) {
            await this.dbAccess.insertNewTeams([team]);
        };

        // add player to team.
        await this.dbAccess.insertNewTeamPlayers([team]);

        return { teamId: team.id, playerId: p.id };
    }


    /**
     * 
     * @param body - { teamId, rank }
     */
    private async postTeamRank(body) {
        logger.debug('Post team rank');
        if (!body.teamId.startsWith("Unknow")) {
            if (body.rank) {
                const rank = body.rank == 0 ? null : body.rank;
                return await this.dbAccess.query(
                    'UPDATE team SET rank = $1 WHERE id = $2',
                    [rank, body.teamId]
                );
            }
        }
    }

        /**
     * 
     * @param body - { teamId, teamName }
     */
    private async postTeamName(body) {
        logger.debug('Post team name');
        if (!isNaN(body.teamId)) {
            const teamName = body.teamName.trim() ? body.teamName.trim() : null;
            return await this.dbAccess.query(
                'UPDATE team SET team_name = $1 WHERE id = $2',
                [teamName, body.teamId]
            );
        }
    }

    private async getTeams(sportId, eventId, orderBy) {
        const events = await this.dbAccess.querySportEvents(sportId); // for nav
        const event = events.find(e => e.id == eventId );
        const teams = await this.dbAccess.queryTeams(sportId, eventId, undefined, undefined, orderBy);
        // TODO: names or players ? Not used for now.
        const candidates = Table.Player.getNames(await this.dbAccess.queryCandidates(event.sport_id, event.id));
        return { teams, events, event, candidates };
    }

    private async getTeam(sportId, eventId, teamId) {
        let team;
        if (isNaN(teamId) && teamId.toLowerCase() == 'new') {
            team = new Table.Team(sportId, eventId, []);
        } else {
            const teams = await this.dbAccess.queryTeams(sportId, eventId, teamId);
            team = teams[0];
        }
        const events = await this.dbAccess.querySportEvents(sportId); // for nav
        const event = events.find(e => e.id == eventId );
        const candidates = await this.dbAccess.queryCandidates(team.sport_id, team.event_id);
        return { team, events, event, candidates };
    }

}