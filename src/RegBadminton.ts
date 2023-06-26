'use strict';

import Bluebird from 'bluebird';
import * as pgPromise from 'pg-promise';
import * as uuid from 'uuid';
import * as XLSX from 'xlsx';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';

const logger = Log.getLogger();
const pgp = pgPromise({ promiseLib: Bluebird });

export class RegBadminton {

    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess) {
      this.dbAccess = dbAccess;
    };

    // get a unique name from player
    private getName(p: Table.Player) {
        return p ? p.cname || (p.first_name + ' ' + p.last_name).toLowerCase() : undefined;
        // return p ? p.getLowerCaseName() : undefined;
    }


    private updateTeam(player: Table.Player, partnerNames: string, players: Table.Player[], 
            teamMap: {[key: string]: Table.Team}, event: Table.SportEvent) {
        
        let tp: Table.TeamPlayer;
        let uniqueName = this.getName(player);
        let team = teamMap[uniqueName];

        if (!team) {
            tp = new Table.TeamPlayer(undefined, player, -1); // new team player
            team = new Table.Team(event.sport_id, event.id, [tp]);
            teamMap[uniqueName] = team;
        }

        if (partnerNames) {
            partnerNames.split(',').forEach(partnerName => {
                const partner = Table.Player.findPlayer(partnerName, players);
                if (partner) {
                    uniqueName = this.getName(partner);
                    const team2 = teamMap[uniqueName];
                    if (! team2) {
                        tp = new Table.TeamPlayer(team.id, partner, -1); // new team player
                        team.players.push(tp);
                        teamMap[uniqueName] = team;
                    } else if (team2 != team) {
                        // merge two team
                        team2.players.forEach(tp => {
                            if (!Table.Team.findPlayer(tp.player, team)){
                                team.players.push(tp);
                                teamMap[this.getName(tp.player)] = team;
                            };
                        });
                    }
                } else { // for render only
                    const p = new Table.Player();
                    p.cname = partnerName ? partnerName + ' ?' : '???';
                    team.players.push(new Table.TeamPlayer(team.id, p, -2)); // fake team player
                }
            });
        }
    }

    // build two level map: eventId -> playerName -> team
    private buildTeamMap(teams: Table.Team[], sport: Table.Sport) {
        const teamMap = {};
        sport.events.forEach(event => {
            teamMap[event.id] = {};
        });
        teams.forEach(team => {
            team.players.forEach(tp => {
                const player: Table.Player = tp.player;
                teamMap[team.event_id][this.getName(player)] = team;    // for each event, each player only attend one team.
            })
        });
        return teamMap;
    }

    private extractTeams(teamMap) {
        const teams = [];
        for (const eventId in teamMap) {
            for (const name in teamMap[eventId]) { 
                const team = teamMap[eventId][name];
                if (teams.indexOf(team) < 0) {
                    teams.push(team);
                }
            }
        }
        return teams;
    }

    public async register(req) {
        const sportId: number = Table.Sport.getIdByName(req.body.sport);
        
        const workbook: XLSX.WorkBook = await XLSX.read(req.file.buffer, {type:'buffer'});
        // const ws: XLSX.WorkSheet = wb.Sheets[wb.SheetNames[0]];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        // TODO: add valdate here
    
        const players: Table.Player[] = await this.dbAccess.queryTable('player');
        const sport: Table.Sport = await this.dbAccess.querySport(sportId);

        // two level map: eventId -> playerName -> team
        const teamMap = {};
        sport.events.forEach(event => {
            teamMap[event.id] = {};
        });

        sheet.forEach(row => {
            // 序号 姓名 报名项目 女双搭档 男双搭档 混双搭档 水平范围

            // find player in db who match an item in the sheet
            const p: Table.Player = Table.Player.findPlayer(row['姓名'], players);
            row['player'] = p;  // for render

            if (!p || (p.sport_id && p.sport_id != sportId)) {
                return;
            }

            // TODO update player table for level updates.
            if (row['水平范围']) {
                p.level = Table.Player.levelMap[row['水平范围']]
            }
            
            row['报名项目'].split(',').forEach(eventName => {
                const event = Table.Sport.getEventByName(eventName, sport);
                let partner;
                if (event.team_size == 2) {
                    partner = row[event.cname + '搭档'];
                }
                this.updateTeam(p, partner, players, teamMap[event.id], event);
            });
        });

        const teams: Table.Team[] = this.extractTeams(teamMap);

        await this.cleanOldTeams(sportId);
        await this.dbAccess.insertNewTeams(teams);
        await this.dbAccess.insertNewTeamPlayers(teams);
        // await this.deleteExpiredTeamPlayers(teams);

        return {sheet, teamMap, eventMap: Table.Sport.getEventIdToEventMap(sport) };
    }

    private async cleanOldTeams(sportId: number) {
        const rows = await this.dbAccess.query(
            'DELETE FROM team WHERE sport_id = $1 RETURNING id;',
            [sportId]
        );
        logger.info("Deleted teams: " + rows);

        const teamIds = [];
        rows.forEach(row => {
            teamIds.push(row.id);
        });

        if (teamIds.length == 0) {
            return;
        }

        const tpIds = await this.dbAccess.query(
            'DELETE FROM team_player WHERE team_id in ($1:csv) RETURNING id;',
            [teamIds]
        );
        logger.info("Deleted team players: " + tpIds);
    }

    private async deleteExpiredTeamPlayers(teams: Table.Team[]) {
        const tpIds = [];
        teams.forEach(team => {
            team.players.forEach(tp => {
                if (tp.status == -3) { // need to delete the team player
                    tpIds.push(tp.id);
                }
            });
        });

        if (tpIds.length == 0) {
            return;
        }

        try {
            const results = await this.dbAccess.query(
                'DELETE FROM team_player WHERE id in ($1:csv) returning id;',
                [tpIds]
            );
            logger.info("Successfully deleted team players.");
        } catch(e) {
            logger.error("Failed to delete team players", e.message);
            throw new Exception("Failed to delete team players", { cause: e });
        };
    }

}