import dayjs from 'dayjs';
import { inject, injectable, singleton } from 'tsyringe';

import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import logger from '../utils/functions/logger-factory.js';

@singleton()
@injectable()
export class BoostService {
  constructor(@inject(AppStateRepository) private appStateRepository: AppStateRepository) {}

  async getTemporaryPayoutModifier(): Promise<number | undefined> {
    try {
      const { karmaBoostStart, karmaBoostExpiry, karmaBoostModifier } =
        await this.appStateRepository.readDataBulk([
          'karmaBoostStart',
          'karmaBoostExpiry',
          'karmaBoostModifier',
        ]);
      const timeNow = dayjs();
      if (
        karmaBoostStart &&
        karmaBoostExpiry &&
        dayjs(karmaBoostStart).isBefore(timeNow) &&
        dayjs(karmaBoostExpiry).isAfter(timeNow)
      ) {
        return karmaBoostModifier;
      }
    } catch (error) {
      logger.error('Failed to get temporary payout modifier:', error);
    }
    return undefined;
  }

  async setTemporaryPayoutModifier(modifier: number, start: Date, expiry: Date): Promise<void> {
    try {
      await this.appStateRepository.writeDataBulk({
        karmaBoostModifier: modifier,
        karmaBoostStart: start,
        karmaBoostExpiry: expiry,
      });
    } catch (error) {
      logger.error('Failed to set temporary payout modifier:', error);
    }
  }
}
