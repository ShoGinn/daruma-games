import { getData, setData } from '../../entities/data.mongo.js';

import logger from './logger-factory.js';

/**
 * Check if the bot is in maintenance mode.
 *
 * @returns {*}  {Promise<boolean>}
 */
export async function isInMaintenance(): Promise<boolean> {
  return await getData('maintenance');
}

/**
 * Set the maintenance state of the bot.
 *
 * @param {boolean} maintenance
 * @returns {*}  {Promise<void>}
 */
export async function setMaintenance(maintenance: boolean): Promise<void> {
  await setData('maintenance', maintenance);
  // Log the maintenance state change
  logger.info(`Maintenance mode: ${maintenance}`);
}
