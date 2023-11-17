/* eslint-disable @typescript-eslint/unbound-method */
import dayjs from 'dayjs';

import { AppStateRepository } from '../../../src/database/app-state/app-state.repo.js';
import { BoostService } from '../../../src/services/boost-payout.js';

describe('BoostService', () => {
  let boostService: BoostService;
  let mockAppStateRepository: jest.Mocked<AppStateRepository>;

  beforeEach(() => {
    mockAppStateRepository = {
      readDataBulk: jest.fn(),
      writeDataBulk: jest.fn(),
    } as unknown as jest.Mocked<AppStateRepository>;
    boostService = new BoostService(mockAppStateRepository);
  });

  describe('getTemporaryPayoutModifier', () => {
    it('should return the modifier if the current time is within the boost period', async () => {
      const now = dayjs();
      const boostStart = now.subtract(1, 'hour');
      const boostExpiry = now.add(1, 'hour');
      const boostModifier = 2;

      mockAppStateRepository.readDataBulk.mockResolvedValue({
        karmaBoostStart: boostStart.toDate(),
        karmaBoostExpiry: boostExpiry.toDate(),
        karmaBoostModifier: boostModifier,
      });

      const result = await boostService.getTemporaryPayoutModifier();

      expect(result).toBe(boostModifier);
    });

    it('should return undefined if the current time is not within the boost period', async () => {
      const now = dayjs();
      const boostStart = now.add(1, 'hour');
      const boostExpiry = now.add(2, 'hour');
      const boostModifier = 2;

      mockAppStateRepository.readDataBulk.mockResolvedValue({
        karmaBoostStart: boostStart.toDate(),
        karmaBoostExpiry: boostExpiry.toDate(),
        karmaBoostModifier: boostModifier,
      });

      const result = await boostService.getTemporaryPayoutModifier();

      expect(result).toBeUndefined();
    });
  });

  describe('setTemporaryPayoutModifier', () => {
    it('should set the boost modifier, start, and expiry', async () => {
      const boostStart = new Date();
      const boostExpiry = new Date();
      const boostModifier = 2;

      await boostService.setTemporaryPayoutModifier(boostModifier, boostStart, boostExpiry);

      expect(mockAppStateRepository.writeDataBulk).toHaveBeenCalledWith({
        karmaBoostModifier: boostModifier,
        karmaBoostStart: boostStart,
        karmaBoostExpiry: boostExpiry,
      });
    });
  });
});
