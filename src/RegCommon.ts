
'use strict';

import Bluebird from 'bluebird';
import * as pgPromise from 'pg-promise';
import { pipeline } from 'stream';
import { format } from 'util';
import * as uuid from 'uuid';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';

const logger = Log.getLogger();
const pgp = pgPromise({ promiseLib: Bluebird });

export class RegCommon {

    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess) {
      this.dbAccess = dbAccess;
    };

    /**
     * 
     * @param sheet upload excel sheet
     * @param columnName column name of association, such as '您所在的校友会(Your Alumni Association)'
     */
    public async updateAssociations(sheet, columnName, doUpdate?) {
        const associations = await this.dbAccess.queryTable('th_association');

        const rows = [];
        sheet.forEach(row => {
            const n = row[columnName];
            if (n && ! associations.find(x => x.cname == n) && ! rows.find(x => x.cname == n)) {
                // found new Association
                rows.push({ 'cname': n });
            }
        });

        if (rows.length > 0) {
            if (doUpdate) {
                const insertColumnSet = new pgp.helpers.ColumnSet([
                        'cname'
                    ],
                    { table: 'th_association' });
        
                const sql = pgp.helpers.insert(rows, insertColumnSet) + ' RETURNING *';
                const asscs = await this.dbAccess.query(sql);
                return associations.concat(asscs);
            } else {
                return associations.concat(rows);
            }
        }
        return associations;
    }

    /**
     * 
     * @param sheet upload excel sheet
     * @param column column name of association, such as '您就读的院系(Department)'
     */
    public async updateDepartment(sheet, column, doUpdate?) {
        const departments = await this.dbAccess.queryTable('th_department');

        const rows = [];
        sheet.forEach(row => {
            const n = row[column];
            if (n && ! departments.find(x => x.cname == n) && ! rows.find(x => x.cname == n)) {
                // found new department
                rows.push({ 'cname': n });
            }
        });

        if (rows.length > 0) {
            if (doUpdate) {
                const insertColumnSet = new pgp.helpers.ColumnSet([
                        'cname'
                    ],
                    { table: 'th_department' });
        
                const sql = pgp.helpers.insert(rows, insertColumnSet) + ' RETURNING *';
                const depts = await this.dbAccess.query(sql);
                return departments.concat(depts);
            } else {
                return departments.concat(rows);
            }
        }
        return departments;
    }

    /**
     * 
     * @param sheet 
     * @param fn - function to convert a row to Player
     */
    public async updatePlayers(sheet, row2PlayerFn, doUpdate?) {
        const players = await this.dbAccess.queryPlayers();

        const newRows = [];
        const updateRows = [];
        sheet.forEach(row => {
            const r = row2PlayerFn(row);
            let p: Table.Player = Table.Player.findPlayerInDb(r, players);
            row['rawPlayer'] = r;  // for render
            row['dbPlayer'] = p;   // for render
            row['action'] = 'none'; // for render

            if (!p) { // new player
                row['action'] = 'new'; // for render
                p = r;
                newRows.push({ 
                    'first_name': p.first_name,
                    'last_name': p.last_name,
                    'cname': p.cname,
                    'gender': p.gender,
                    'age': p.age,
                    'th_department_id': p.th_department_id,
                    'th_department_name': p.th_department_name,
                    'th_association_id': p.th_association_id,
                    'th_association_name': p.th_association_name,
                    'sport_id': p.sport_id,
                    'level': p.level
                });
            } else { // udpate player
                p = this.updateIfDiff(p, r);
                if (p) {
                    row['action'] = 'update'; // for render
                    let s = "(" + p.id + ",";
                    s += p.first_name ? ("'" + p.first_name + "',") : "null,";
                    s += p.last_name ? ("'" + p.last_name + "',") : "null,";
                    s += p.cname ? ("'" + p.cname + "',") : "null,";
                    s += p.gender ? ("'" + p.gender + "',") : "null,";
                    s += p.age ? (p.age + ",") : "null::smallint,";
                    s += p.th_department_id ? (p.th_department_id + ",") : "null::integer,";
                    s += p.th_department_name ? ("'" + p.th_department_name + "',") : "null,";
                    s += p.th_association_id ? (p.th_association_id + ",") : "null::integer,";
                    s += p.th_association_name ? ("'" + p.th_association_name + "',") : "null,";
                    s += p.sport_id ? (p.sport_id + ",") : "null::integer,";
                    s += p.level ? (p.level + ")") : "null::smallint)";

                    updateRows.push(s);
                }
            }
        });

        if (doUpdate) {
            if (newRows.length > 0) {
                const insertColumnSet = new pgp.helpers.ColumnSet([
                    'first_name',
                    'last_name',
                    'cname',
                    'gender',
                    'age',
                    'th_department_id',
                    'th_department_name',
                    'th_association_id',
                    'th_association_name',
                    'sport_id',
                    'level'
                    ],
                    { table: 'player' });
        
                const sql = pgp.helpers.insert(newRows, insertColumnSet) + ' ';
                await this.dbAccess.query(sql);
            };

            if (updateRows.length > 0) {
                const values = updateRows.join();

                const sql = format(
                    `UPDATE player as p
                        SET
                            first_name = v.first_name,
                            last_name = v.last_name,
                            cname = v.cname,
                            gender = v.gender,
                            age = v.age,
                            th_department_id = v.th_department_id,
                            th_department_name = v.th_department_name,
                            th_association_id = v.th_association_id,
                            th_association_name = v.th_association_name,
                            sport_id = v.sport_id,
                            level = v.level
                        FROM (
                            VALUES
                                %s
                            ) AS v (id,first_name,last_name,cname,gender,age,th_department_id,th_department_name,th_association_id,th_association_name,sport_id,level)
                        WHERE p.id = v.id
                        RETURNING *`,
                        values);
                await this.dbAccess.query(sql);
            }
        }
        if (doUpdate) {
            return await this.dbAccess.queryPlayers();
        } else {
            return players.concat(newRows);
        }
    }

    /**
     * Return new player if diff, otherwise return undefined.
     * @param p Player from DB
     * @param r Player from registration row
     */
    private updateIfDiff(p: Table.Player, r: Table.Player) {
        let changed = false;
        const q = { ...r }; // make a copy

        q.id = p.id;
        // Keep original name when available in DB
        if ((!p.first_name || !p.last_name) && (q.first_name && q.last_name)) {
            changed = true;
        } else {
            q.first_name = p.first_name;
            q.last_name = p.last_name;
        }
        if (!p.cname && q.cname) {
            changed = true;
        } else {
            q.cname = p.cname;
        }
        // Keep origianl gender when available in DB
        if (!p.gender && q.gender) {
            changed = true;
        } else {
            q.gender = p.gender;
        }
        // Update age when available in sheet
        if (q.age && p.age != q.age) {
            changed = true;
        } else {
            q.age = p.age;
        }
        // Update association, department and sport, could remove from DB
        if (p.th_association_id != q.th_association_id) {
            changed = true;
        } else {
            q.th_association_id = p.th_association_id;
            q.th_association_name = p.th_association_name;
        }
        if (p.th_department_id != q.th_department_id) {
            changed = true;
        } else {
            q.th_department_id = p.th_department_id;
            q.th_department_name = p.th_department_name;
        }
        if (q.sport_id && p.sport_id != q.sport_id) {
            changed = true;
        } else {
            q.sport_id = p.sport_id;
        }
        // Update level when available in sheet.
        if (!p.level && q.level) {
            changed = true;
        } else {
            q.level = p.level;
        }
        return changed ? q : undefined;
    }

}