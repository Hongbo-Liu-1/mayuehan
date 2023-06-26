'use strict';

import Bluebird from 'bluebird';
import * as pgPromise from 'pg-promise';
import * as XLSX from 'xlsx';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { RegCommon } from './RegCommon';

const logger = Log.getLogger();
const pgp = pgPromise({ promiseLib: Bluebird });
// 姓名	院系	校友会	性别

const title = {
    cname: '姓名',
    gender: '性别',
    th_department_name: '院系',
    th_association_name: '校友会',
    team_name: '队名'
}

export class RegSportEvent {

    private dbAccess: DbAccess;
    private regCommon: RegCommon;

    private players: Table.Player[];
    private departments: Table.Department[];
    private associations: Table.Association[];

    constructor(dbAccess: DbAccess) {
      this.dbAccess = dbAccess;
      this.regCommon = new RegCommon(dbAccess);
    };

    public async register(req) {
        const eventId: number = req.body.sportEvent;
        const events: Table.SportEvent[] = await this.dbAccess.querySportEvents(undefined, eventId);
        if (!events || events.length == 0) {
            return new Result(400, "Cannot find the event.", {}); 
        }
        const sportId: number = events[0].sport_id;
        
        const workbook: XLSX.WorkBook = await XLSX.read(req.file.buffer, {type:'buffer'});
        // const ws: XLSX.WorkSheet = wb.Sheets[wb.SheetNames[0]];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const doUpdate = req.body.action && req.body.action === 'update';

        // TODO: add valdate here
        this.associations = await this.dbAccess.queryTable('th_association');
        this.departments = await this.dbAccess.queryTable('th_department');

        // Do not update players
        // this.players = await this.regCommon.updatePlayers(sheet, this.row2Player.bind(this), doUpdate);
        this.players = await this.regCommon.updatePlayers(sheet, this.row2Player.bind(this), false);

        const rawTeams: Table.Team[] = this.generateTeams(sheet, sportId, eventId, events[0]);

        if (doUpdate) {
            await this.cleanOldTeams(sportId, eventId);
            await this.dbAccess.insertNewTeams(rawTeams);
            await this.dbAccess.insertNewTeamPlayers(rawTeams);
        }

        return {sheet};
    }

    private generateTeams(sheet, sportId, eventId, event: Table.SportEvent): Table.Team[] {
        const teams: Table.Team[] = [];
        let team: Table.Team;
        sheet.forEach(row => {
            // find player in db who match an item in the sheet
            const r: Table.Player = this.row2Player(row);
            const player: Table.Player = Table.Player.findPlayerInDb(r, this.players);
            if (!player) {
                logger.debug("Emm!");
            }

            if (event.team_size == 1) {
                team = new Table.Team(sportId, eventId, []);
                team.addPlayer(player);
                teams.push(team);
            } else {
                const teamName = row[title.team_name];
                if (!teamName) {
                    throw new Exception('Team Name column [' + title.team_name + ' ] does not exist !');
                }
                team = teams.find(x => x.team_name == teamName);
                if (!team) {
                    team = new Table.Team(sportId, eventId, [], teamName);
                    teams.push(team);
                }
                team.addPlayer(player); // new team player
            }
        });
        return teams;
    }


    private async cleanOldTeams(sportId: number, eventId: number) {
        const rows = await this.dbAccess.query(
            'DELETE FROM team WHERE sport_id = $1 AND event_id = $2 RETURNING id;',
            [sportId, eventId]
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

    // 姓名	院系	校友会	性别
    private row2Player(row) {
        const p = new Table.Player();
        if (row[title.cname]) {
            p.cname = row[title.cname].trim();
        }
        if (row[title.gender]) {
            p.gender = row[title.gender].trim();
        }
        if (row[title.th_department_name]) {
            p.th_department_name = row[title.th_department_name] ? row[title.th_department_name].trim() : undefined;
            if (p.th_department_name) {
                const d = this.departments.find(x => x.cname === p.th_department_name);
                if (d) {
                    p.th_department_id = d.id;
                }
            }
        }
        if (row[title.th_association_name]) {
            p.th_association_name = row[title.th_association_name] ? row[title.th_association_name].trim() : undefined;
            if (p.th_association_name) {
                const a = this.associations.find(x => x.cname === p.th_association_name);
                if (a) {
                    p.th_association_id = a.id;
                }
            }
        }
        return p;
    }

}