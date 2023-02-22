import parser from 'cron-parser';
import { isValidCron } from 'cron-validator';
import { Client } from 'discordx';
import * as schedule from 'node-schedule';
import { container } from 'tsyringe';
import type { constructor } from 'tsyringe/dist/typings/types';

import logger from '../../../utils/functions/LoggerFactory.js';

const FREQUENCY = 'Once';

/**
 * Schedule a job to be executed at a specific time (cron)
 * @param cronExpression - cron expression to use (e.g: "0 0 * * *" will run each day at 00:00)
 * @param jobName - name of the job (the name of the function will be used if it is not provided)
 */
export function Schedule(
    cronExpression: string
): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
    if (!isValidCron(cronExpression, { alias: true, seconds: true })) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const interval = getNextInterval(cronExpression);
    const client = getClient();

    return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void => {
        container.afterResolution(
            target?.constructor as constructor<unknown>,
            (_t, result) => {
                logger.info(
                    `Register method: "${target?.constructor.name}.${propertyKey}()" to run using cron expression: ${cronExpression} (next run: ${interval})`
                );
                schedule.scheduleJob(cronExpression, descriptor.value.bind(result, client));
            },
            { frequency: FREQUENCY }
        );
    };
}

function getNextInterval(cronExpression: string): string {
    return parser.parseExpression(cronExpression).next().toString();
}

function getClient(): Client | null {
    return container.isRegistered(Client) ? container.resolve(Client) : null;
}
