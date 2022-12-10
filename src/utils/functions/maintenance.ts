import { Data } from '../../entities/Data.js';
import { Database } from '../../services/Database.js';
import { resolveDependency } from './dependency.js';

/**
 * Get the maintenance state of the bot.
 */
export async function isInMaintenance(): Promise<boolean> {
    const db = await resolveDependency(Database);
    const dataRepository = db.get(Data);
    const maintenance = await dataRepository.get('maintenance');

    return maintenance;
}

/**
 * Set the maintenance state of the bot.
 */
export async function setMaintenance(maintenance: boolean): Promise<void> {
    const db = await resolveDependency(Database);
    const dataRepository = db.get(Data);
    await dataRepository.set('maintenance', maintenance);
}
