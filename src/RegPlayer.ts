'use strict';


import Bluebird from 'bluebird';
import * as pgPromise from 'pg-promise';
import { format } from 'util';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';


const pgp = pgPromise({ promiseLib: Bluebird });

export class RegPlayer {

    private dbAccess: DbAccess;

    constructor(dbAccess: DbAccess) {
        this.dbAccess = dbAccess;
    };


    // create, update, delete player
    // req.body - player from form
    public async postPlayer(req) {
        const playerId = req.params.playerId;
        if (req.body.delete) {
            return await this.deletePlayer(playerId);
        }

        const playerInForm = req.body;
        await this.validateAndUpdateName(playerInForm);

        if (!isNaN(playerId)) {
            return await this.updatePlayer(playerId, playerInForm);
        } else {
            return await this.createPlayer(playerId, playerInForm);
        }
    }


    private async deletePlayer(playerId) {
        if (isNaN(playerId)) {
            throw new Exception("Invalid parameter.");
        }
        const players: Table.Player[] = await this.dbAccess.query('SELECT * FROM player WHERE id = $1', playerId);
        if (!players || players.length == 0) {
            throw new Exception("Cannot find the player.");
        }
        const player = players[0];

        await this.dbAccess.query("DELETE FROM player WHERE id = $1", [playerId]);

        return new Result(0, "此选手已经成功删除。", { player });
    }

    private async validateAndUpdateName(playerInForm) {
        const departments = await this.dbAccess.queryDepartments('cname');
        const associations = await this.dbAccess.queryAssociations('cname');
        const sports = await this.dbAccess.query('SELECT * FROM sport');

        if (!playerInForm.sport_id || playerInForm.sport_id == -1) {
            playerInForm.sport_id = undefined;
        } else if (!sports.find(d => d.id == playerInForm.sport_id)) {
            throw new Exception("Invalid sport_id.")
        }

        if (!playerInForm.th_department_id || playerInForm.th_department_id == -1) {
            playerInForm.th_department_id = undefined;
        } else {
            const department = departments.find(d => d.id == playerInForm.th_department_id);
            if (department) {
                playerInForm.th_department_name = department.cname;
            } else {
                throw new Exception("Invalid th_department_id.")
            }
        }

        if (!playerInForm.th_association_id || playerInForm.th_association_id == -1) {
            playerInForm.th_association_id = undefined;
        } else {
            const association = associations.find(d => d.id == playerInForm.th_association_id);
            if (association) {
                playerInForm.th_association_name = association.cname;
            } else {
                throw new Exception("Invalid th_association_id.")
            }
        }

        if (!playerInForm.cname || playerInForm.cname.trim().length < 2) {
            throw new Exception("Invalid cname.")
        }
    }

    private async updatePlayer(playerId, playerInForm) {
        const players: Table.Player[] = await this.dbAccess.query('SELECT * FROM player WHERE id = $1', playerId);
        if (!players || players.length == 0) {
            throw new Exception("Cannot find the player.");
        }
        const player = players[0];

        if (!this.updateIfDiff(player, playerInForm)) { // No change then return;
            return playerInForm;
        }

        const values = this.formatForUpdate(playerInForm);
        const sql = format(
            `UPDATE player as p
            SET
                first_name = v.first_name,
                last_name = v.last_name,
                cname = v.cname,
                gender = v.gender,
                th_department_id = v.th_department_id,
                th_department_name = v.th_department_name,
                th_association_id = v.th_association_id,
                th_association_name = v.th_association_name,
                sport_id = v.sport_id
            FROM (
                VALUES
                    %s
                ) AS v (id,first_name,last_name,cname,gender,th_department_id,th_department_name,th_association_id,th_association_name,sport_id)
            WHERE p.id = v.id
            RETURNING *`,
            values);
        return await this.dbAccess.query(sql);
    }

    private async createPlayer(playerId, playerInForm) {
        if (playerId.toLowerCase() != 'new') {
            throw new Exception("Invalid parameter.")
        }
        const newRows = [this.formatForInsert(playerInForm)];
        const insertColumnSet = new pgp.helpers.ColumnSet([
            'first_name',
            'last_name',
            'cname',
            'gender',
            'th_department_id',
            'th_department_name',
            'th_association_id',
            'th_association_name',
            'sport_id'
        ],
            { table: 'player' });
        const sql = pgp.helpers.insert(newRows, insertColumnSet) + '  RETURNING *';
        return await this.dbAccess.query(sql);
    }


    /**
     * Return updated player if diff, otherwise return undefined.
     * @param p Player from DB
     * @param r Player from registration row
     */
    private updateIfDiff(p: Table.Player, q: Table.Player) {
        if (p.id != q.id) {
            throw new Exception("Invalid data");
        }
        if (p.first_name != q.first_name ||
            p.last_name != q.last_name ||
            p.cname != q.cname ||
            p.gender != q.gender ||
            p.th_association_id != q.th_association_id ||
            p.th_department_id != q.th_department_id ||
            p.sport_id != q.sport_id) {
            return q;
        }
        return undefined;
    }

    private formatForInsert(p: Table.Player) {
        return {
            'first_name': p.first_name,
            'last_name': p.last_name,
            'cname': p.cname,
            'gender': p.gender,
            'th_department_id': p.th_department_id,
            'th_department_name': p.th_department_name,
            'th_association_id': p.th_association_id,
            'th_association_name': p.th_association_name,
            'sport_id': p.sport_id
        };
    }

    private formatForUpdate(p: Table.Player) {
        let s = "(" + p.id + ",";
        s += p.first_name ? ("'" + p.first_name + "',") : "null,";
        s += p.last_name ? ("'" + p.last_name + "',") : "null,";
        s += p.cname ? ("'" + p.cname + "',") : "null,";
        s += p.gender ? ("'" + p.gender + "',") : "null,";
        s += p.th_department_id ? (p.th_department_id + ",") : "null::integer,";
        s += p.th_department_name ? ("'" + p.th_department_name + "',") : "null,";
        s += p.th_association_id ? (p.th_association_id + ",") : "null::integer,";
        s += p.th_association_name ? ("'" + p.th_association_name + "',") : "null,";
        s += p.sport_id ? (p.sport_id + ")") : "null::integer)";
        //s += p.level ? (p.level + ")") : "null::smallint)";
        return s;
    }
}