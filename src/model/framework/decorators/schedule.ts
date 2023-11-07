import { Client } from 'discordx';

import parser from 'cron-parser';
import { isValidCron } from 'cron-validator';
import * as schedule from 'node-schedule';
import { container } from 'tsyringe';
import type { constructor } from 'tsyringe/dist/typings/types';

import logger from '../../../utils/functions/logger-factory.js';

const FREQUENCY = 'Once';

/**
 * Schedule a job to be executed at a specific time (cron)
 *
 * @param {string} cronExpression - cron expression to use (e.g: "0 0 * * *" will run each day at 00:00)
 * @returns {*}  {(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void}
 */
export function Schedule(
  cronExpression: string,
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void {
  if (!isValidCron(cronExpression, { alias: true, seconds: true })) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const interval = getNextInterval(cronExpression);
  const client = getClient();
  /* istanbul ignore next */
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void => {
    container.afterResolution(
      target?.constructor as constructor<unknown>,
      (_t, result) => {
        logger.info(
          `Register method: "${
            target?.constructor.name ?? 'unk'
          }.${propertyKey}()" to run using cron expression: ${cronExpression} (next run: ${interval})`,
        );
        schedule.scheduleJob(cronExpression, descriptor.value.bind(result, client));
      },
      { frequency: FREQUENCY },
    );
  };
}

function getNextInterval(cronExpression: string): string {
  return parser.parseExpression(cronExpression).next().toString();
}
/* istanbul ignore else */
function getClient(): Client | null {
  return container.isRegistered(Client)
    ? container.resolve(Client)
    : /* istanbul ignore next */ null;
}
