import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import logger from './logger-factory.js';
import { Data } from '../../entities/data.entity.js';

/**
 * Get the maintenance state of the bot.
 */
export async function isInMaintenance(): Promise<boolean> {
    const database = container.resolve(MikroORM).em.fork();
    const dataRepository = database.getRepository(Data);

    return await dataRepository.get('maintenance');
}

/**
 * Set the maintenance state of the bot.
 *
 * @param {boolean} maintenance
 * @returns {*}  {Promise<void>}
 */
export async function setMaintenance(maintenance: boolean): Promise<void> {
    const database = container.resolve(MikroORM).em.fork();
    const dataRepository = database.getRepository(Data);
    await dataRepository.set('maintenance', maintenance);
    // Log the maintenance state change
    logger.info(`Maintenance mode ${maintenance ? 'enabled' : 'disabled'}`);
}
