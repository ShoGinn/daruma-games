/* istanbul ignore file */
import { Client } from 'discordx';

import { AsyncTask, SimpleIntervalJob, ToadScheduler } from 'toad-scheduler';
import { container } from 'tsyringe';
import type { constructor } from 'tsyringe/dist/typings/types';

import MethodExecutorTimeUnit from '../../../enums/method-executor-time-unit.js';
import logger from '../../../utils/functions/logger-factory.js';

export const scheduler = new ToadScheduler();

/**
 * Run a method on this bean every x as defined by the time unit. <br />
 * <strong>Note: the class containing this method must be registered with tsyringe for this decorator to work</strong>
 *
 * @param {number} time
 * @param {(MethodExecutorTimeUnit | string)} timeUnit
 * @param {boolean} [runImmediately=false]
 * @returns {*}  {(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void}
 */
export function RunEvery(
  time: number,
  timeUnit: MethodExecutorTimeUnit | string,
  runImmediately: boolean = false,
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void {
  const client = container.isRegistered(Client) ? container.resolve(Client) : null;
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void => {
    container.afterResolution(
      target?.constructor as constructor<unknown>,
      (_t, result) => {
        const task = new AsyncTask(
          `${target?.constructor.name ?? 'unk'}.${propertyKey}`,
          () => {
            return descriptor.value.call(result, client);
          },
          (error) => {
            logger.error(error);
          },
        );
        const job = new SimpleIntervalJob(
          {
            runImmediately,
            [timeUnit]: time,
          },
          task,
        );
        logger.info(
          `Register method: "${
            target?.constructor.name ?? 'unk'
          }.${propertyKey}()" to run every ${time} ${timeUnit}`,
        );
        scheduler.addSimpleIntervalJob(job);
      },
      {
        frequency: 'Once',
      },
    );
  };
}
