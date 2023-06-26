'use strict';

import Bluebird from 'bluebird';
import { id } from 'inversify';
import * as pgPromise from 'pg-promise';
import * as util from 'util';

import * as Database from '../libs/database';
import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import * as Table from '../model/Table';

const pgp = pgPromise({ promiseLib: Bluebird });
const logger = Log.getLogger();

export class DbAccess {
    private config: any;
    private database: Database;

    constructor(config: any, database: Database) {
        this.database = database;
        this.config = config;
    }

    public async queryTable(table: string) {
        try {
            const rows = await this.database.execute(
                'SELECT * FROM ' + table
            );
            logger.debug("Successfully query table %s", table);
            logger.debug("Returned %d rows", rows.length);
            return rows;
        } catch (e) {
            logger.error("Failed to query table %s: %s", table, e.message);
            throw new Exception("Failed to query table", { cause: e });
        };
    };

    public async query(sql: string, parms?: any) {
        if (sql.charAt(sql.length-1) != ';') {
            sql += ';';
        }
        try {
            const rows = await this.database.execute(sql, parms);
            logger.debug("Successfully query %s", sql);
            logger.debug("Returned %d rows", rows.length);
            return rows;
        } catch (e) {
            logger.error("Failed to query %s: %s", sql, e.message);
            throw new Exception("Failed to query", { cause: e });
        };
    };

    /**
     * Query sport by id
     * @param sportId
     * @returns Sport
     */
    public async querySport(sportId: number) {
        try {
            const sports: Table.Sport[] = await this.query('SELECT * FROM sport WHERE id = ' + sportId);
            const sport = sports[0];
            sport.events = await this.query(
                `SELECT s.cname as sport_name, e.*
                FROM sport s 
                JOIN sport_event e 
                ON s.id = e.sport_id
                WHERE s.id = $1`,
                [sportId]
            );
            return sport;
        } catch (e) {
            logger.error("Failed to query sport %d: %s", sportId, e.message);
            throw new Exception("Failed to query sport " + sportId, { cause: e });
        }
    }

    /**
     * Query all Sports
     * @return Sport[]
     */
    public async querySports() {
        try {
            const sports: Table.Sport[] = await this.query('SELECT * FROM sport');
            const events: Table.SportEvent[] = await this.query(
                `SELECT s.cname as sport_name, e.*
                FROM sport s 
                JOIN sport_event e 
                ON s.id = e.sport_id`
            );
            const sportMap = {};
            sports.forEach(sport => {
                sport.events = [];
                sportMap[sport.id] = sport;
            });

            events.forEach(event => {
                const sport: Table.Sport = sportMap[event.sport_id];
                sport.events.push(event);
            });

            return sports;
        } catch (e) {
            logger.error("Failed to query sport", e.message);
            throw new Exception("Failed to query sports", { cause: e });
        }
    }


    public async querySportEvents(sportId?: number, eventId?: number) {
        const sql = `SELECT s.cname as sport_name, e.*
            FROM sport s 
            JOIN sport_event e 
            ON s.id = e.sport_id`;

        let rows = [];
        if (eventId) {
            rows = await this.query(
                sql + ' WHERE e.id = $1 ORDER BY e.id',
                [eventId]);
        } else if (sportId) {
            rows = await this.query(
                sql + ' WHERE s.id = $1 ORDER BY e.id',
                [sportId]);
        } else {
            rows = await this.query(sql + ' ORDER BY e.id');
        }

        if (!rows || rows.length == 0) {
            throw new Exception("Failed to query events for sportId=" + sportId + " eventId=" + eventId);
        }
        logger.debug("Successful query [%d] events for [sportId=%d, eventId=%d].", rows.length, sportId, eventId);
        return rows;
    }

    public async queryPlayers(departmentId?, associationId?, playerId?, sportId?, orderBy?) {
        orderBy = orderBy ? this.trimSingleQuote(orderBy) : "id";

        const sql = 
            `SELECT p.*, s.cname as sport_name
                FROM player as p
                LEFT JOIN sport as s
                ON p.sport_id = s.id`;

        let rows;
        if (departmentId) {
            rows = await this.query(sql +
                ' WHERE th_department_id = $1 ORDER BY ' + orderBy,
                [departmentId]);
        } else if (associationId) {
            rows = await this.query(sql +
                ' WHERE th_association_id = $1 ORDER BY ' + orderBy,
                [associationId]);
        } else if (playerId) {
            rows = await this.query(sql +
                ' WHERE p.id = $1;',
                [playerId]);
        } else if (sportId) {
            rows = await this.query(sql +
                ' WHERE p.sport_id = $1 ORDER BY ' + orderBy,
                [sportId]);
        } else {
            rows = await this.query(sql + ' ORDER BY ' + orderBy);
        }
         
        logger.debug("Successful query [%d] players.", rows.length);
        return rows;
    }

    // query all players which is registered for the sport.
    public async queryCandidates(sportId, eventId) {
        let sql;
        let rows;
        if (eventId == 11) {
            sql = 
                `SELECT * FROM player
                WHERE id NOT IN (
                    SELECT tp.player_id AS id
                    FROM team_player as tp
                    JOIN team as t
                    ON tp.team_id = t.id
                    WHERE t.event_id = 11
                )
                ORDER BY gender, cname, first_name;`;
            rows = await this.query(sql);
        } else {
            sql = 
                `SELECT p.*
                FROM player as p
                JOIN sport as s
                    ON p.sport_id = s.id
                WHERE p.sport_id = $1 AND p.id NOT IN (
                    SELECT tp.player_id
                    FROM team_player as tp
                    JOIN team as t
                    ON tp.team_id = t.id
                    WHERE t.event_id = $2
                )
                ORDER BY gender, cname, first_name;`;
            rows = await this.query(
                    sql,
                    [sportId, eventId]
                );
        }

        logger.debug("Successful query candidates for [sportId=%s].", sportId)
        logger.debug("Returned %d rows", rows.length);
        return rows;
    }


    /**
     * query team by eventId or sportId
     * @param eventId 
     * @param sportId 
     * @return Team[]
     */
    public async queryTeam(teamId: number) {
        const teams = await this.query(
            `SELECT t.*, s.cname AS sport_name, e.cname AS event_name, e.team_size
                FROM team AS t
                LEFT JOIN sport AS s
                ON t.sport_id = s.id
                LEFT JOIN sport_event AS e 
                ON t.event_id = e.id
                WHERE t.id = $1`,
            [teamId]);

        if (!teams || teams.length != 1) {
            return undefined;
        }

        const players = await this.query(
            `SELECT p.*, tp.team_id
                FROM team_player as tp
                JOIN team as t
                ON tp.team_id = t.id
                JOIN player as p
                ON tp.player_id = p.id
                WHERE t.id = $1`,
            [teamId]);

        const team = teams[0];
        players.forEach(p => {
            const tp = new Table.TeamPlayer(team.id, p, 0);
            team.players.push(tp);
        });

        logger.debug("Successfully query team for [teamId = %d]. Returned %d players", teamId, players.length);
        return team;

    }

    private trimSingleQuote(s) {
        return s ? s.replace(/(^')|('$)/g, "") : s;
    }

    /**
     * query team by eventId or sportId
     * @param eventId 
     * @param sportId 
     * @return Team[]
     */
    public async queryTeams(sportId?: number, eventId?: number, teamId?: number, playerId?: number, orderBy?: string) {
        orderBy = orderBy ? this.trimSingleQuote(orderBy) : 'team_name';
        orderBy = orderBy != 'team_name' ? orderBy : 
            `COALESCE(SUBSTRING(team_name FROM '^(\\d+)')::INTEGER, 99999999),
            SUBSTRING(team_name FROM '[a-zA-z_-]+'),
            COALESCE(SUBSTRING(team_name FROM '(\\d+)$')::INTEGER, 0),
            team_name, id`;

        const teamSql =
            `SELECT t.*, s.cname AS sport_name, e.cname AS event_name, e.team_size
            FROM team AS t
            LEFT JOIN sport AS s
            ON t.sport_id = s.id
            LEFT JOIN sport_event AS e 
            ON t.event_id = e.id`;

        let teams: Table.Team[] = [];
        if (teamId) {
            teams = await this.query(teamSql + 
                ' WHERE t.id = $1',
                [teamId]);
        } else if (eventId) {
            teams = await this.query(teamSql + 
                ' WHERE t.event_id = $1 ORDER BY ' + orderBy,
                [eventId]);
        } else if (sportId) {
            teams = await this.query(teamSql + 
                ' WHERE t.sport_id = $1 ORDER BY ' + orderBy,
                [sportId]);
        } else if (playerId) {
            teams = await this.query(teamSql + 
                ` JOIN team_player AS tp
                    ON t.id = tp.team_id
                  WHERE tp.player_id = $1`,
                [playerId]);
        } else {
            teams = await this.query(teamSql + " ORDER BY " + orderBy);
        };
            
        if (!teams || teams.length == 0) {
            return [];
            // throw new Exception("Failed to query teams for sportId=" + sportId + " eventId=" + eventId + " teamId=" + teamId);
        }

        const teamMap = {};
        teams.forEach(team => {
            team.players = [];
            teamMap[team.id] = team;
        });


        let playerSql = `
            SELECT p.*, tp.team_id
            FROM team_player as tp
            INNER JOIN team as t
            ON tp.team_id = t.id
            INNER JOIN player as p
            ON tp.player_id = p.id`;
        
        let players: Table.Player[] = [];
        if (teamId) {
            players = await this.query(playerSql +
                ' WHERE t.id = $1 ORDER BY p.gender, p.id',
                [teamId]);
        } else if (eventId) {
            players = await this.query(playerSql +
                ' WHERE t.event_id = $1 ORDER BY p.gender, p.id',
                [eventId]);
        } else if (sportId) {
            players = await this.query(playerSql +
                ' WHERE t.sport_id = $1 ORDER BY p.gender, p.id',
                [sportId]);
        } else if (playerId) {
            const teamIds = teams.map(p => {
                return p.id;
            });
            playerSql = util.format(playerSql +
                ' WHERE t.id in (%s) ORDER BY p.gender, p.id',
                teamIds);
            players = await this.query(playerSql);
        } else {
            players = await this.query(playerSql +
                ' ORDER BY p.gender, p.id');
        }

        players.forEach(p => {
            const team = teamMap[p.team_id];
            const tp = new Table.TeamPlayer(team.id, p, 0);
            team.players.push(tp);
        });

        logger.debug("Successfully query teams for [sport_id = %d, event_id = %d, team_id = %d]. Returned %d teams.", 
            sportId, eventId, teamId, teams.length);
        return teams;
    }


    public async insertNewTeams(teams: Table.Team[]) {
        const columnSet = new pgp.helpers.ColumnSet([
            'uuid',
            'team_name',
            'sport_id',
            'event_id',
            'rank'
        ],
            { table: 'team' });

        const dataSet = [];
        teams.forEach(team => {
            dataSet.push({ uuid: team.uuid, team_name: team.team_name, sport_id: team.sport_id, event_id: team.event_id, rank: team.rank });
        });

        if (dataSet.length == 0) {
            return;
        }

        const query = pgp.helpers.insert(dataSet, columnSet) + ' RETURNING id, uuid';
        try {
            const rows = await this.query(query)
            logger.info("Successfully inserted teams");

            const map = new Map();
            for (const row of rows) {
                map.set(row.uuid, row);
            }

            teams.forEach(team => {
                if (map.has(team.uuid)) {
                    const row = map.get(team.uuid);
                    team.id = row.id;
                } else {
                    logger.error("Failed to insert team: [sport_id: %s], [event_id=%s], [name=%s]", team.sport_id, team.event_id, team.players[0].player.cname);
                }
            });
        } catch (e) {
            logger.error("Failed to insert teams: %s", e.message);
            throw new Exception("Failed to insert teams", { cause: e });
        };
    }


    public async insertNewTeamPlayers(teams: Table.Team[]) {
        const columnSet = new pgp.helpers.ColumnSet([
            'team_id',
            'player_id'
        ],
            { table: 'team_player' });

        const dataSet = [];
        teams.forEach(team => {
            if (team.id) {
                team.players.forEach(tp => {
                    if (tp.status == -1) { // need to create new team player
                        dataSet.push({ team_id: team.id, player_id: tp.player_id });
                    }
                });
            }
        });

        if (dataSet.length == 0) {
            return;
        }

        const query = pgp.helpers.insert(dataSet, columnSet) + ' RETURNING id';
        try {
            const rows = await this.query(query)
            logger.info("Successfully inserted team players." + rows);
        } catch (e) {
            logger.error("Failed to insert team players", e.message);
            throw new Exception("Failed to insert team players", { cause: e });
        };
    }


    public async queryAssociations(orderBy?) {
        orderBy = orderBy ? this.trimSingleQuote(orderBy) : "id";

        const rows = await this.query('SELECT * FROM th_association ORDER BY ' + orderBy);
         
        logger.debug("Successful query [%d] associations.", rows.length);
        return rows;
    }


    public async queryDepartments(orderBy?) {
        orderBy = orderBy ? this.trimSingleQuote(orderBy) : "id";

        const rows = await this.query('SELECT * FROM th_department ORDER BY ' + orderBy);
         
        logger.debug("Successful query [%d] departments.", rows.length);
        return rows;
    }

    public async queryUserByName(userName: string) {
        const rows = await this.query(
            'SELECT * FROM user_detail WHERE user_name = $1',
            [userName]
        );
        return rows ? rows[0] : undefined;
    }

    public async queryUserById(userId: number) {
        const rows = await this.query(
            'SELECT * FROM user_detail WHERE id = $1',
            [userId]
        );
        return rows ? rows[0] : undefined;
    }

}