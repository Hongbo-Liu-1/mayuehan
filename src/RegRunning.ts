'use strict';

import Bluebird from 'bluebird';
import * as pgPromise from 'pg-promise';
import * as uuid from 'uuid';
import * as XLSX from 'xlsx';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { RegCommon } from './RegCommon';

const logger = Log.getLogger();
const pgp = pgPromise({ promiseLib: Bluebird });
// 英文姓名	中文姓名	院系	校友会	性别	接力队名
const title = {
    ename: '英文姓名',
    cname: '中文姓名',
    gender: '性别',
    th_department_name: '院系',
    th_association_name: '校友会',
    team_name: '接力队名'
}

export class RegRunning {

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
        const sportId: number = Table.Sport.getIdByName(req.body.sport);
        
        const workbook: XLSX.WorkBook = await XLSX.read(req.file.buffer, {type:'buffer'});
        // const ws: XLSX.WorkSheet = wb.Sheets[wb.SheetNames[0]];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const doUpdate = req.body.action && req.body.action === 'update';

        // TODO: add valdate here

        // Do not update Associations and Department
        // this.associations = await this.regCommon.updateAssociations(sheet, '校友会', doUpdate);
        // this.departments = await this.regCommon.updateDepartment(sheet, '院系', doUpdate);
        this.associations = await this.dbAccess.queryTable('th_association');
        this.departments = await this.dbAccess.queryTable('th_department');

        // Do not update players
        // this.players = await this.regCommon.updatePlayers(sheet, this.row2Player.bind(this), doUpdate);
        this.players = await this.regCommon.updatePlayers(sheet, this.row2Player.bind(this), false);

        const rawTeams: Table.Team[] = this.generateTeams(sheet, sportId);

        if (doUpdate) {
            await this.cleanOldTeams(sportId);
            await this.dbAccess.insertNewTeams(rawTeams);
            await this.dbAccess.insertNewTeamPlayers(rawTeams);
        }

        return {sheet};
    }

    private generateTeams(sheet, sportId): Table.Team[] {
        const teams: Table.Team[] = [];
        sheet.forEach(row => {
            // // 英文姓名	中文姓名	院系	校友会	性别	接力队名

            // find player in db who match an item in the sheet
            const r: Table.Player = this.row2Player(row);
            const player: Table.Player = Table.Player.findPlayerInDb(r, this.players);
            if (!player) {
                logger.debug("Emm!");
            }

            let team: Table.Team;
            const teamName = row[title.team_name];
            if (! teamName) {
                return; // skip
            }
            // Add to RelayRace team
            team = teams.find(x => x.team_name == teamName);
            if (!team) {
                team = new Table.Team(sportId, Table.SportEventEnum.RelayRace, [], teamName);
                teams.push(team);
            }
            team.addPlayer(player); // new team player

            // Also need to add to other single team
            let eventId;
            if (player.age >= 50 && player.gender == '男') {
                eventId = Table.SportEventEnum.MenOver50;
            } else if (player.age >= 50 && player.gender == '女') {
                eventId = Table.SportEventEnum.WomenOver50;
            } else if (player.age <= 49 && player.gender == '男') {
                eventId = Table.SportEventEnum.MenUnder49;
            } else {
                eventId = Table.SportEventEnum.WomenUnder49;
            }
            team = new Table.Team(sportId, eventId, []);
            team.addPlayer(player);
            teams.push(team);

        });
        return teams;
    }


    private async cleanOldTeams(sportId: number) {
        const rows = await this.dbAccess.query(
            'DELETE FROM team WHERE sport_id = $1 AND event_id != $2 RETURNING id;',
            [sportId, Table.SportEventEnum.MorningRunning]
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

    // 英文姓名	中文姓名	院系	校友会	性别	接力队名
    private row2Player(row) {
        const p = new Table.Player();
        if (row[title.ename]) {
            const ename = row[title.ename].trim();
            const i = ename.lastIndexOf(' ');
            if (i > 0) {
                p.first_name = ename.slice(0, i).trim();
                p.last_name = ename.slice(i+1).trim();
            } else {
                p.first_name = ename;
            }
        }
        if (row[title.cname]) {
            p.cname = row[title.cname].trim();
        }
        if (row[title.gender]) {
            p.gender = row[title.gender].trim();
        }
        if (row[title.th_department_name]) {
            p.th_department_name = row[title.th_department_name].trim();
            p.th_department_id = this.departments.find(x => x.cname == p.th_department_name).id;
        }
        if (row[title.th_association_name]) {
            p.th_association_name = row[title.th_association_name].trim();
            p.th_association_id = this.associations.find(x => x.cname == p.th_association_name).id;
        }
        if (row[title.team_name]) {
            p.sport_id = 1;  // running
            p.sport_name = '跑步';
        }
        return p;
    }

}