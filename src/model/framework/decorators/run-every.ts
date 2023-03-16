/* istanbul ignore file */
import { Client } from 'discordx';
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler';
import { container } from 'tsyringe';
import type { constructor } from 'tsyringe/dist/typings/types';

import METHOD_EXECUTOR_TIME_UNIT from '../../../enums/method-executor-time-unit.js';
import logger from '../../../utils/functions/logger-factory.js';

export const scheduler = new ToadScheduler();

/**
 * Run a method on this bean every x as defined by the time unit. <br />
 * <strong>Note: the class containing this method must be registered with tsyringe for this decorator to work</strong>
 *
 * @param {number} time
 * @param {(METHOD_EXECUTOR_TIME_UNIT | string)} timeUnit
 * @param {boolean} [runImmediately=false]
 * @returns {*}  {(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void}
 */
export function RunEvery(
    time: number,
    timeUnit: METHOD_EXECUTOR_TIME_UNIT | string,
    runImmediately: boolean = false
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void {
    const client = container.isRegistered(Client) ? container.resolve(Client) : null;
    return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void => {
        container.afterResolution(
            target?.constructor as constructor<unknown>,
            (_t, result) => {
                const task = new AsyncTask(
                    `${target?.constructor.name}.${propertyKey}`,
                    () => {
                        return descriptor.value.call(result, client);
                    },
                    error => {
                        logger.error(error);
                    }
                );
                const job = new SimpleIntervalJob(
                    {
                        runImmediately,
                        [timeUnit]: time,
                    },
                    task
                );
                logger.info(
                    `Register method: "${target?.constructor.name}.${propertyKey}()" to run every ${time} ${timeUnit}`
                );
                scheduler.addSimpleIntervalJob(job);
            },
            {
                frequency: 'Once',
            }
        );
    };
}
