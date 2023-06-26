'use strict';

import * as Log         from '../libs/Log';

const logger = Log.getLogger();

export class Result {
    public status: number;  // 0: ok, > 0 error number
    public message: string;  // available when status > 0
    public data: any;

    constructor(status: number, message: string, data: any) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    public static async wrap(fn: () => any) {
        try {
            const data = await fn();
            if (data instanceof Result) {
                return data;
            } else {
                return new Result(0, undefined, data);
            }
        } catch (e) {
            logger.error("Internal error", e);
            // TODO: Add error number to Error ?
            return new Result(503, e.message, undefined);
        };
    }
}