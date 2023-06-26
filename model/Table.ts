'use strict';

import * as crypto from 'crypto';
import * as uuid from 'uuid';

import * as Log from '../libs/Log';

const logger = Log.getLogger();

export class Association {
    // 'th_association' table columns
    public id: number;
    public ename: string;
    public cname: string;
    public points: number;
    public online_run_join: boolean;
    public online_run_rank: number;
    public online_run_points: number;
}

export class Court {
    // 'court' table columns
    public id: number;
    public ename: string;
    public cname: string;
    public busy: boolean;
    public sport_id: number;
}


export class Department {
    // 'th_department' table columns
    public id: number;
    public ename: string;
    public cname: string;
    public points: number;

}

/**
 * This table is used to save app attribute and value. For example:
 * 1, 'activeVersion', '1.0.0'
 * 2, 'currentRound', , 5
 */
export class Info {
    // 'info' table columns
    public id: number;
    public name: string;
    public text_value: string;
    public int_value: number;
    public update_time: Date;
}

export class Match {
    // 'match' table columns
    public id: number;
    public sport_id: number;
    public event_id: number;
    public court_id: number;
    public round: number;
    public start_time: Date;
    public end_time: Date;

    // list of teams to play the match
    public matchTeams: [];

    constructor(sportId: number, eventId: number, courtId: number, round: number) {
        this.sport_id = sportId;
        this.event_id = eventId;
        this.court_id = courtId;
        this.round = round;
        this.matchTeams = [];
    }
}

export class MatchTeam {
    // 'match_team' table columns
    public id: number;
    public match_id: number;
    public team_id: number;
    public score1: number;
    public score2: number;
    public score3: number;
    public match_points: number;
    public set_points: number;
    public small_points: number;
}

export enum PlayerStatusEnum {
    Initial = 0,
    Locked = 1,
    Disabled = 2
};

export enum PlayerLevelEnum {
    Entry = 0,
    Middle = 1,
    High = 2
};

export class Player {
    // 'player' table columns
    public id: number;
    public first_name: string;
    public last_name: string;
    public cname: string;
    public gender: string;
    public age: number;
    public email: string;
    public wechat_id: string;
    public phone: string;
    public th_department_id: number;
    public th_department_name: string;
    public th_association_id: number;
    public th_association_name: string;
    public sport_id: number;
    public sport_name: string;
    public attendee_no: number;
    public level: number;
    public status: number;  // 0: initial, 1: locked, 2: disabled
    public points: number;

    // helper
    public team_id: number;

    // helper
    public static levelMap = { '高手': 3, '中级': 2, '入门': 1 };

    public static getLowerCaseEname(p: Player) {
        return p ? ((p.first_name || '') + ' ' + (p.last_name || '')).trim().toLowerCase() : undefined;
    }

    public static getLowerCaseName(p: Player) {
        return p ? (p.cname || Player.getLowerCaseEname(p)) : undefined;
    }

    public static getPlayerById(players: Player[], id) {
        for (const p of players) {
            if (p.id == id) {
                return p;
            }
        }
        return undefined;
    }

    public static getNames(players: Player[]) {
        const names = [];
        players.forEach(p => {
            if (p.cname) {
                names.push(p.cname);
            } else {
                names.push(p.first_name + ' ' + p.last_name);
            }
        });
        return names;
    }

    /**
     * @param r  - player from registration sheet row
     * @param players - list of players from DB
     * @return DB player if found
     *   - undefined if cannot find player
     */
    public static findPlayerInDb(r: Player, players: Player[]) {
        let cname = r.cname ? r.cname : '';
        cname = cname.length < 2 ? undefined : cname; // chinese name too short

        let ename = Player.getLowerCaseEname(r);
        ename = (ename.split(' ').length < 2) ? undefined : ename; // one word name is too short
        const enames = ename ? ename.split(' ') : undefined;

        for (const p of players) {
            try {
                if (cname && p.cname) { // when both have chinese name, only compare chinese name.
                    if (cname === p.cname) {
                        return p;
                    } else {
                        continue;
                    }
                }

                if (!ename) {   // skip if no english name
                    continue;
                }

                const pe = Player.getLowerCaseEname(p);
                if (!pe || pe.split(' ').length < 2) { // one work english is too short
                    continue;
                }

                if (ename == pe) {
                    return p;
                }

                // skip if any of the following not match
                if (p.attendee_no && r.attendee_no && p.attendee_no !== r.attendee_no) {
                    continue;
                }
                if (p.gender && r.gender && p.gender !== r.gender) {
                    continue;
                }
                if (p.th_association_id && r.th_association_id && p.th_association_id !== r.th_association_id) {
                    continue;
                }
                if (p.th_department_id && r.th_department_id && p.th_department_id !== r.th_department_id) {
                    continue;
                }

                // now safe to do smart match :=)
                const pes = pe.split(' ');
                if (enames.every(e => pes.indexOf(e) >= 0) || pes.every(e => enames.indexOf(e) >= 0)) {
                    return p;
                }

                /*
                if (qe.startsWith(pe) || qe.endsWith(pe)) {
                    return p;
                }
                
                if (p.cname && (qname.startsWith(p.cname) || qname.endsWith(p.cname))) {
                    return p;
                }
                */
            } catch (error) {
                logger.debug("Error when try to match player", error);
            }
        }
        return undefined;
    };

    /**
     * @param qname  - name string from sport registration sheet
     * @param players - list of players
     * @return DB player row if found
     *   - undefined if qname is empty, or cannot find player
     */
    public static findPlayer(qname: string, players: Player[]) {
        if (!qname || qname.trim().length < 2) {
            return undefined;
        }

        for (const p of players) {
            try {
                if (qname == p.cname) {
                    return p;
                }
                const pe = (p.first_name + ' ' + p.last_name).toLowerCase();
                const qe = qname.toLowerCase();
                if (qe == pe) {
                    return p;
                }

                const qes = qe.split(' ');
                const pes = pe.split(' ');
                if (qes.every(e => pes.indexOf(e) >= 0) || pes.every(e => qes.indexOf(e) >= 0)) {
                    return p;
                }
                if (p.cname && (qe == (p.cname.charAt(0) + p.first_name).toLowerCase())) { // Chinese last name + English first name
                    return p;
                }
                if (p.cname && (qe == (p.first_name).toLowerCase() + p.cname.charAt(0))) { // English first name + Chinese last name 
                    return p;
                }

                if (qe.startsWith(pe) || qe.endsWith(pe)) {
                    return p;
                }
                /*
                if (p.cname && (qname.startsWith(p.cname) || qname.endsWith(p.cname))) {
                    return p;
                }
                */
            } catch (error) {
                logger.debug("Error when try to match player", error);
            }
        }
        return undefined;
    };

}


export enum SportEnum {
    Running = 1,
    Gold = 2,
    Badminton = 3,
    Tennis = 4,
    TableTennis = 5
};


export class Sport {
    // 'sport' table column
    public id: number;
    public ename: string;
    public cname: string;
    public points_rule: string;

    // list of events of the sport.
    public events: SportEvent[];

    public static nameToIdMap = {
        '跑步': 1,
        '高尔夫球': 2,
        '羽毛球': 3,
        '网球': 4,
        '乒乓球': 5
    };

    public static getIdByName(name: string) {
        return Sport.nameToIdMap[name];
    }

    public static getEventByName(eventName: string, sport: Sport) {
        for (const event of sport.events) {
            if (eventName == event.cname) {
                return event;
            }
        }
        return undefined;
    }
    /*
        public getEventById(eventId: number) {
            for (const event of this.events) {
                if (eventId == event.id) {
                    return event;
                }
            }
            return undefined;
        }
    */
    public static getEventIdToEventMap(sport: Sport) {
        const map = {};
        sport.events.forEach(e => {
            map[e.id] = e;
        });
        return map;
    }
}


export enum SportEventEnum {
    MorningRunning = 11,
    RelayRace = 12,
    MenOver50 = 13,
    WomenOver50 = 14,
    MenUnder49 = 15,
    WomenUnder49 = 16,

    Golf = 21,

    BadmintonMD = 31,
    BadmintonWD = 32,
    BadmintonXD = 33,
    BadmintonMS = 34,
    BadmintonWS = 35,

    TennisMD = 41,
    TennisWD = 42,
    TennisXD = 43,
    TennisMS = 44,
    TennisWS = 45,

    TableTennisMD = 51,
    TableTennisWD = 52,
    TableTennisXD = 53,
    TableTennisMS = 54,
    TableTennisWS = 55
};

export class SportEvent {
    // 'sport_event' table column
    public id: number;
    public ename: string;
    public cname: string;
    public sport_id: number;
    public team_size: number;
    public team_prefix: string;
    public sheet_title: string;
}

export class Team {
    // 'team' table columns
    public id: number;
    public uuid: string;
    public team_name: string;
    public sport_id: number;
    public sport_name: string;
    public event_id: number;
    public event_name: string;
    public tournament_id: number;
    public score: string;
    public rank: number;
    public points: number;
    public note: string;
    public status: number;   // 0: initial, 1: locked, 2: disabled

    // list of players of the team.
    public players: TeamPlayer[];

    constructor(sportId: number, eventId: number, players: TeamPlayer[] = [], name?) {
        this.uuid = uuid.v4();
        this.team_name = name;
        this.sport_id = sportId;
        this.event_id = eventId;
        this.players = players;
        this.status = -1;   // new team
    }

    public addPlayer(p: Player) {
        if (this.players.find(tp => tp.player_id == p.id)) {
            return;
        }
        this.players.push(new TeamPlayer(this.id, p, -1));
    }

    public static findPlayer(player: Player, team: Team) {
        return team.players.find(tp => tp.player_id == player.id);
    }
}

export class TeamPlayer {
    // 'team_player' table columns
    public id: number;
    public team_id: number;
    public player_id: number;

    // help column
    public status: number;
    public player: Player;

    constructor(teamId: number, player: Player, status: number) {
        this.team_id = teamId;
        this.player_id = player.id;
        this.player = player;
        this.status = status;
    }
}

export class User {
    // 'team_player' table columns
    public id: number;
    public user_name: string;
    public password: string;
    public user_type: string;   // guest, ops, admin
    public sport_id: number;

    /*
    constructor() {
        this.user_name = 'guest';
        this.user_type = 'guest';
    }
    */
    public static sha256(password: string) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    public static hasPermission(user: User, sportId) {
        return user.user_type === 'ops'
            || (user.user_type === 'admin' && (!sportId || user.sport_id == sportId));
    }

}
