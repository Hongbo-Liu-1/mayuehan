'use strict';

import * as XLSX from 'xlsx';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { RegCommon } from './RegCommon';

const logger = Log.getLogger();

export class RegDownload {

    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess) {
        this.dbAccess = dbAccess;
    }

    public async generateWorkbookData() {
        var wb = XLSX.utils.book_new();

        const sports: Table.Sport[] = await this.dbAccess.querySports();

        await this.addPlayers(wb);
        sports.forEach(s => {
            s.events.forEach(async e => {
                await this.addEvent(wb, e);
            })
        });
  
        return  XLSX.write(wb, {bookType:"xlsx", type:'buffer'})
    }

    private async addEvent(wb: XLSX.WorkBook, event: Table.SportEvent) {
        const teams: Table.Team[] = await this.dbAccess.queryTeams(event.sport_id, event.id);

        const wsData = [];
        wsData.push(['编号','队名','队员','名次']);
        teams.forEach(t => {
            const cnames = t.players.map(tp => tp.player.cname).join();
            wsData.push([t.id, t.team_name, cnames, t.rank]);
        });

        // convert to worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);
  
        /* Add the worksheet to the workbook */
        // TODO
        // XLSX.utils.book_append_sheet(wb, ws, event.sport_name +'-' + event.cname);
    }

    private async addPlayers(wb: XLSX.WorkBook) {
        const players: Table.Player[] = await this.dbAccess.queryPlayers();

        const wsData = [];
        wsData.push(['编号','中文名','First Name','Last Name','性别','院系','分会','类别']);
        players.forEach(p => {
            wsData.push([p.id, p.cname, p.first_name, p.last_name, p.gender, p.th_association_name, p.th_association_name, p.sport_name]);
        });

        // convert to worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);
  
        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, '选手');
    }
}
