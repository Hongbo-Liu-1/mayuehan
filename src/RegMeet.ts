'use strict';

import * as XLSX from 'xlsx';

import * as Log from '../libs/Log';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { RegCommon } from './RegCommon';

const logger = Log.getLogger();

const genderValueMap = {
    '女(Female)': '女',
    '男(Male)': '男'
};

const sportValueMap = {
    '长跑(Long-Distance Race)': '跑步',
    '高尔夫球(Golf)': '高尔夫球',
    '网球(Tennis)': '网球',
    '羽毛球(Badminton)': '羽毛球',
    '乒乓球(Pingpong)': '乒乓球'
};

// 请您选择参赛主项目 (Sport Program)	您的英文名(First Name)	您的英文姓(Last Name)	您的中文名(Name in Chinese)	您的性别 (Gender)	您就读的院系(Department)	您所在的校友会(Your Alumni Association)	您所属校友的中文名(Name in Chinese)
// 乒乓球(Pingpong)	Jean	Zu	祖武争	女(Female)	电机系	纽约	
const title = {
    first_name : '您的英文名(First Name)',
    last_name : '您的英文姓(Last Name)',
    cname : '您的中文名(Name in Chinese)',
    gender : '您的性别 (Gender)',
    th_department_name : '您就读的院系(Department)',
    th_association_name : '您所在的校友会(Your Alumni Association)',
    sport_name : '请您选择参赛主项目 (Sport Program)'
}

export class RegMeet {

    private dbAccess: DbAccess;
    private regCommon: RegCommon;

    private players: Table.Player[];
    private departments: Table.Department[];
    private associations: Table.Association[];
    private sports: Table.Sport[];

    constructor(dbAccess: DbAccess) {
      this.dbAccess = dbAccess;
      this.regCommon = new RegCommon(dbAccess);
    }

    public async register(req) {
        const workbook = await XLSX.read(req.file.buffer, {type:'buffer'});
        // const ws: XLSX.WorkSheet = wb.Sheets[wb.SheetNames[0]];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const doUpdate = req.body.action && req.body.action === 'update';

        // TODO: add valdate here
        this.sports = await this.dbAccess.queryTable('sport');
        this.associations = await this.regCommon.updateAssociations(sheet, title.th_association_name, doUpdate);
        this.departments = await this.regCommon.updateDepartment(sheet, title.th_department_name, doUpdate);
        await this.regCommon.updatePlayers(sheet, this.row2Player.bind(this), doUpdate);
        // return this.players;
        return { sheet };
    }

    private row2Player(row) {
        const p = new Table.Player();
        if (row[title.first_name]) {
            p.first_name = row[title.first_name].trim();
        }
        if (row[title.last_name]) {
            p.last_name = row[title.last_name].trim();
        }
        if (row[title.cname]) {
            p.cname = row[title.cname].trim();
        }
        if (row[title.gender]) {
            p.gender = genderValueMap[row[title.gender].trim()]; // 女(Female) ==> 女
        }
        if (row[title.th_department_name]) {
            p.th_department_name = row[title.th_department_name].trim();
            p.th_department_id = this.departments.find(x => x.cname == p.th_department_name).id;
        }
        if (row[title.th_association_name]) {
            p.th_association_name = row[title.th_association_name].trim();
            p.th_association_id = this.associations.find(x => x.cname == p.th_association_name).id;
        }
        if (row[title.sport_name]) {
            const sportName = sportValueMap[row[title.sport_name]]; // 乒乓球(Pingpong) ==> 乒乓球
            p.sport_id = this.sports.find(x => x.cname == sportName).id;
        }
        return p;
    }

}