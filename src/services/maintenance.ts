import { inject, injectable, singleton } from 'tsyringe';

import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import logger from '../utils/functions/logger-factory.js';

@singleton()
@injectable()
export class MaintenanceService {
  constructor(@inject(AppStateRepository) private appStateRepository: AppStateRepository) {}

  /**
   * Check if the bot is in maintenance mode.
   *
   * @returns {*}  {Promise<boolean>}
   */
  async isInMaintenance(): Promise<boolean> {
    return await this.appStateRepository.readData('maintenance');
  }

  /**
   * Set the maintenance state of the bot.
   *
   * @param {boolean} maintenance
   * @returns {*}  {Promise<void>}
   */
  async setMaintenance(maintenance: boolean): Promise<void> {
    await this.appStateRepository.writeData('maintenance', maintenance);
    // Log the maintenance state change
    logger.info(`Maintenance mode: ${maintenance}`);
  }
}
