import { container } from 'tsyringe';

import { Data } from '../../entities/Data.js';
import { Database } from '../../services/Database.js';

/**
 * Get the maintenance state of the bot.
 */
export async function isInMaintenance(): Promise<boolean> {
    const db = container.resolve(Database);
    const dataRepository = db.get(Data);
    const maintenance = await dataRepository.get('maintenance');

    return maintenance;
}

/**
 * Set the maintenance state of the bot.
 */
export async function setMaintenance(maintenance: boolean): Promise<void> {
    const db = container.resolve(Database);
    const dataRepository = db.get(Data);
    await dataRepository.set('maintenance', maintenance);
}
