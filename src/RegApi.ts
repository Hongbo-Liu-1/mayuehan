'use strict';

import Bluebird from 'bluebird';
import * as multer from 'multer';
import * as pgPromise from 'pg-promise';
import { format } from 'util';

import * as Exception from '../libs/exceptions/Exception';
import * as Log from '../libs/Log';
import { Result } from '../model/Result';
import * as Table from '../model/Table';
import { DbAccess } from './DbAccess';
import { RegBadminton } from './RegBadminton';
import { RegMeet } from './RegMeet';
import { RegRunning } from './RegRunning';
import { RegSportEvent } from './RegSportEvent';

const logger = Log.getLogger();
const pgp = pgPromise({ promiseLib: Bluebird });
const upload = multer();

export class RegApi {
  private dbAccess: DbAccess;

  constructor(dbAccess: DbAccess, express) {
    this.dbAccess = dbAccess;

    express.get('/reg/sports', async (req, res) => {
      const results = await Result.wrap(async () => {
        return await this.dbAccess.querySportEvents();
      });
      res.render('pages/sports', { user: req.user, results });
    });

    express.get('/reg/upload1', async (req, res) => {
      const results = new Result(0, undefined, 'compare');
      res.render('pages/upload1', { user: req.user, results });
    });

    express.get('/reg/upload1u', async (req, res) => {
      // const results = new Result(0, undefined, 'update');
      // res.render('pages/upload1', { user: req.user, results });

      const results = new Result(503, 'API Disabled.', undefined);
      res.render('pages/sports', { user: req.user, results });
    });

    // req.query.action = 'compare' or 'update'
    express.post('/reg/upload1', upload.single('players'), async (req, res) => {
      /*
      const results = await Result.wrap(async () => {
        return await new RegMeet(this.dbAccess).register(req);
      });
      */
      const results = new Result(503, 'API Disabled.', undefined);
      res.render('pages/upload1r', { user: req.user, results });
    });

    express.get('/reg/upload2', async (req, res) => {
      const results = new Result(0, undefined, 'compare');
      res.render('pages/upload2', { user: req.user, results });
    });

    express.get('/reg/upload2u', async (req, res) => {
      const results = new Result(503, 'API Disabled.', undefined);
      // const results = new Result(0, undefined, 'update');
      res.render('pages/upload2', { user: req.user, results });
    });

    express.post('/reg/upload2', upload.single('players'), async (req, res) => {
      const sportId: number = Table.Sport.getIdByName(req.body.sport);
      const results = await Result.wrap(async () => {
        switch (req.body.sport) {
          case '羽毛球':
            throw new Exception("API Disabled !");
          // return await new RegBadminton(this.dbAccess).register(req);
          case '跑步':
            throw new Exception("API Disabled !");
          // return await new RegRunning(this.dbAccess).register(req);
          case '高尔夫球':
          case '网球':
          case '乒乓球':
            throw new Exception("Under Construction !");
          default:
            throw new Exception("Unknow Sport !");
        }
      });

      switch (req.body.sport) {
        case '羽毛球':
          res.render('pages/upload2rBadminton', { user: req.user, results });
          break;
        case '跑步':
          res.render('pages/upload2rRunning', { user: req.user, results });
          break;
        case '高尔夫球':
        case '网球':
        case '乒乓球':
        default:
          res.render('pages/upload2rMorningRunning', { user: req.user, results }); // Will display error message
      }
    });


    express.get('/reg/upload3', async (req, res) => {
      const results = await Result.wrap(async () => {
        const events = await this.dbAccess.querySportEvents();
        return { events, action: 'compare' };
      });
      res.render('pages/upload3', { user: req.user, results });
    });

    express.get('/reg/upload3u', async (req, res) => {
      const results = await Result.wrap(async () => {
        const events = await this.dbAccess.querySportEvents();
        return { events, action: 'update' };
      });
      res.render('pages/upload3', { user: req.user, results });
    });

    express.post('/reg/upload3', upload.single('players'), async (req, res) => {
      const results = await Result.wrap(async () => {
        return await new RegSportEvent(this.dbAccess).register(req);
      });
      res.render('pages/upload3r', { user: req.user, results });
    });

    express.get('/reg/players', async (req, res) => {
      const results = await Result.wrap(async () => {
        return await this.dbAccess.queryPlayers(undefined, undefined, undefined, undefined, req.query.orderBy);
      });
      res.render('pages/playersReg', { user: req.user, results });
    });

    express.get('/reg/player/:playerId', async (req, res) => {
      const results = await Result.wrap(async () => {
        return await this.getPlayer(req.params.playerId);
      });
      res.render('pages/playerEdit', { user: req.user, results });
    });

    express.post('/reg/player/:playerId', async (req, res) => {
      let results0 = await Result.wrap(async () => {
        if (!Table.User.hasPermission(req.user, undefined)) {
          throw new Exception("No permission !")
        }
        return await this.postPlayer(req);
      });

      if (results0.status == 0) {
        const results = await Result.wrap(async () => {
          return await this.dbAccess.queryPlayers(undefined, undefined, undefined, undefined, req.query.orderBy);
        });
        res.render('pages/playersReg', { user: req.user, results });
      } else {
        const results = await Result.wrap(async () => {
            const data = await this.getPlayer(req.params.playerId);
            data.player = req.body;
            results0.data = data;
            return results0;
        });
        res.render('pages/playerEdit', { user: req.user, results });
      }
    });

  }

  private async getPlayer(id) {
    let player;
    if (isNaN(id) && id.toLowerCase() == 'new') {
      player = new Table.Player();
    } else {
      const players = await this.dbAccess.queryPlayers(undefined, undefined, id);
      player = players[0];
    }
    const departments = await this.dbAccess.queryDepartments('cname');
    const associations = await this.dbAccess.queryAssociations('cname');
    const sports = await this.dbAccess.query('SELECT * FROM sport');

    return { player, departments, associations, sports };
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

  private async postPlayer(req) {
    const playerId = req.params.playerId;
    if (req.body.delete) {
      return await this.deletePlayer(playerId);
    }
    const departments = await this.dbAccess.queryDepartments('cname');
    const associations = await this.dbAccess.queryAssociations('cname');
    const sports = await this.dbAccess.query('SELECT * FROM sport');

    const playerInForm = req.body;
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

    if (!isNaN(playerId)) {
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
    } else {
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