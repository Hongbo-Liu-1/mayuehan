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

export class Team {
  private dbAccess: DbAccess;

  constructor(dbAccess: DbAccess) {
    this.dbAccess = dbAccess;
  }


  // ???
  public async queryTeams(sportId, eventId) {
    const events = await this.dbAccess.querySportEvents(sportId);
    const event = events.find(e => e.id == eventId );
    const teams = await this.dbAccess.queryTeams(eventId);
    return { teams, event, events };
  }

}