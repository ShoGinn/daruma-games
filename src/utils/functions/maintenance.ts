import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { Data } from '../../entities/Data.js';

/**
 * Get the maintenance state of the bot.
 */
export async function isInMaintenance(): Promise<boolean> {
    const db = container.resolve(MikroORM).em.fork();
    const dataRepository = db.getRepository(Data);
    const maintenance = await dataRepository.get('maintenance');

    return maintenance;
}

/**
 * Set the maintenance state of the bot.
 */
export async function setMaintenance(maintenance: boolean): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();
    const dataRepository = db.getRepository(Data);
    await dataRepository.set('maintenance', maintenance);
    // Log the maintenance state change
    logger.info(`Maintenance mode ${maintenance ? 'enabled' : 'disabled'}`);
}
