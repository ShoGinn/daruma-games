import { mock } from 'ts-mockito';
import { container } from 'tsyringe';

import { generateDiscordId } from '../../../tests/setup/test-funcs.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { StatsService } from '../../services/stats.js';
import { GameBonusData } from '../../types/daruma-training.js';

import { IIncreaseDecrease } from './dt-cooldown-factory.constants.js';
import * as dtCoolDownFactory from './dt-cooldown-factory.js';

const discordId = generateDiscordId();
describe('Cool Down factory', () => {
  describe('calculateIncAndDec', () => {
    const medianMaxes = {
      aboveMedianMax: {
        increase: 10,
        decrease: 5,
      },
      belowMedianMax: {
        increase: 15,
        decrease: 10,
      },
    };

    test('calculates correct increase and decrease for asset stat above average', () => {
      const assetStat = 8;
      const average = 5;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 4, decrease: 2 });
    });

    test('calculates correct increase and decrease for asset stat below average', () => {
      const assetStat = 2;
      const average = 5;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 12, decrease: 8 });
    });

    test('calculates correct increase and decrease for asset stat equal to average', () => {
      const assetStat = 5;
      const average = 5;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 3, decrease: 2 });
    });
    test('calculates correct increase and decrease for asset stat max above', () => {
      const assetStat = 50;
      const average = 5;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 10, decrease: 5 });
    });
    test('calculates correct increase and decrease for asset stat max below', () => {
      const assetStat = 1;
      const average = 5;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 15, decrease: 10 });
    });
    test('calculates correct increase and decrease if an assetStat is 0 and average is 1', () => {
      const assetStat = 0;
      const average = 1;
      const result = dtCoolDownFactory.calculateIncAndDec(medianMaxes, assetStat, average);
      expect(result).toEqual({ increase: 15, decrease: 10 });
    });
  });
  describe('calculateTimePct', () => {
    test('should calculate the increase and decrease times correctly', () => {
      const factorPct = { increase: 10, decrease: 5 };
      const channelCoolDown = 60_000;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result.increase).toBeGreaterThan(0);
      expect(result.decrease).toBeGreaterThan(0);
    });
    test('returns for max decrease', () => {
      const factorPct = { increase: 0, decrease: 0.8 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 0,
        decrease: 360,
      });
    });
    test('returns for max increase', () => {
      const factorPct = { increase: 0.3, decrease: 0.2 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 288,
        decrease: 90,
      });
    });
    test('returns 0 for decrease when decreaseMaxChance is 0', () => {
      const factorPct = { increase: 0.3, decrease: 0 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 288,
        decrease: 0,
      });
    });

    test('returns 0 for increase when increaseMaxChance is 0', () => {
      const factorPct = { increase: 0, decrease: 0.2 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 0,
        decrease: 90,
      });
    });

    test('returns correct values for channelCoolDown = 0', () => {
      const factorPct = { increase: 0.3, decrease: 0.2 };
      const channelCoolDown = 0;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 0,
        decrease: 0,
      });
    });

    test('returns correct values for incPct = 0', () => {
      const factorPct = { increase: 0, decrease: 0.2 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 0,
        decrease: 90,
      });
    });

    test('returns correct values for decPct = 0', () => {
      const factorPct = { increase: 0.3, decrease: 0 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 288,
        decrease: 0,
      });
    });
    test('returns correct values incPct and decPct = 0', () => {
      const factorPct = { increase: 0, decrease: 0 };
      const channelCoolDown = 360;

      const result = dtCoolDownFactory.calculateTimePct(factorPct, channelCoolDown);

      expect(result).toEqual({
        increase: 0,
        decrease: 0,
      });
    });
  });
  describe('coolDownRolls', () => {
    test('returns the inputs and does not use the random function', () => {
      const mockFunction = jest.fn().mockReturnValue(1);
      const result = dtCoolDownFactory.coolDownRolls(mockFunction);
      expect(result).toEqual({ increaseRoll: 1, decreaseRoll: 1 });
    });
    test('returns the inputs and uses the random function for increase', () => {
      const mockFunction = jest.fn().mockReturnValue(0);
      const result = dtCoolDownFactory.coolDownRolls(mockFunction);
      expect(result).toEqual({ increaseRoll: 0, decreaseRoll: 0 });
      expect(mockFunction).toHaveBeenCalled();
    });
    test('checks that it uses the default random function', () => {
      const result = dtCoolDownFactory.coolDownRolls();
      expect(result).toBeDefined();
      expect(result.decreaseRoll).toBeGreaterThanOrEqual(0);
      expect(result.increaseRoll).toBeGreaterThanOrEqual(0);
    });
  });
  describe('rollForCoolDown', () => {
    afterAll(() => {
      container.clearInstances();
      container.reset();
      jest.clearAllMocks();
    });
    const asset = {} as unknown as AlgoNFTAsset;
    const user = {
      id: discordId,
    };
    const channelCooldown = 3600;
    const factorChancePctFunction = jest.fn().mockReturnValue({ increase: 0, decrease: 0 });
    const coolDownRollsFunction = jest.fn().mockReturnValue({ increaseRoll: 0, decreaseRoll: 0 });
    test('returns the cooldown sent', async () => {
      const result = await dtCoolDownFactory.rollForCoolDown(
        asset,
        user.id,
        channelCooldown,
        coolDownRollsFunction,
        factorChancePctFunction,
      );
      expect(result).toBe(3600);
    });
    test('returns an increased cooldown', async () => {
      factorChancePctFunction.mockReturnValue({ increase: 0.1, decrease: 0 });
      coolDownRollsFunction.mockReturnValue({ increaseRoll: 0, decreaseRoll: 0 });
      const result = await dtCoolDownFactory.rollForCoolDown(
        asset,
        user.id,
        channelCooldown,
        coolDownRollsFunction,
        factorChancePctFunction,
      );
      expect(result).toBeCloseTo(4560);
    });
    test('returns a decreased cooldown', async () => {
      factorChancePctFunction.mockReturnValue({ increase: 0, decrease: 0.1 });
      coolDownRollsFunction.mockReturnValue({ increaseRoll: 0, decreaseRoll: 0 });
      const result = await dtCoolDownFactory.rollForCoolDown(
        asset,
        user.id,
        channelCooldown,
        coolDownRollsFunction,
        factorChancePctFunction,
      );
      expect(result).toBeCloseTo(3150);
    });
    test('checks to see if it calls the random function', async () => {
      const result = await dtCoolDownFactory.rollForCoolDown(
        asset,
        user.id,
        channelCooldown,
        undefined,
        factorChancePctFunction,
      );
      expect(result).toBeDefined();
    });
    test('should throw an error with no factorChancePctFunction', async () => {
      const mockedStatsService = mock(StatsService);
      container.register(StatsService, { useValue: mockedStatsService });

      const result = await dtCoolDownFactory.rollForCoolDown(
        asset,
        user.id,
        channelCooldown,
        coolDownRollsFunction,
      );
      expect(result).toBeDefined();
    });
  });
  describe('calculateFactorChancePct', () => {
    const bonusStats: GameBonusData = {
      averageTotalGames: 25,
      averageTotalAssets: 5,
      averageRank: 120,
      assetTotalGames: 0,
      userTotalAssets: 0,
      assetRank: 0,
      averageWins: 0,
      assetWins: 0,
    };

    test('calculates the increase/decrease chance correctly', () => {
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeGreaterThan(0);
      expect(result.decrease).toBeGreaterThan(0);
    });
    test('calculates for a brand new daruma owner', () => {
      bonusStats.assetTotalGames = 1;
      bonusStats.userTotalAssets = 1;
      bonusStats.assetRank = 1000;
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0, 2);
      expect(result.decrease).toBeCloseTo(0.8, 2);
    });
    test('calculates for a massive owner', () => {
      bonusStats.assetTotalGames = 200;
      bonusStats.userTotalAssets = 80;
      bonusStats.assetRank = 1;
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0.3, 2);
      expect(result.decrease).toBeCloseTo(0.2, 2);
    });
    test('calculates for a normal owner', () => {
      bonusStats.assetTotalGames = 10;
      bonusStats.userTotalAssets = 3;
      bonusStats.assetRank = 118;
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0.0025, 3);
      expect(result.decrease).toBeCloseTo(0.504, 3);
    });
    test('calculates for a diamond owner', () => {
      bonusStats.assetTotalGames = 40;
      bonusStats.userTotalAssets = 16;
      bonusStats.assetRank = 10;
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0.2485, 3);
      expect(result.decrease).toBeCloseTo(0.2, 3);
    });
    test('calculates for a demon owner', () => {
      bonusStats.assetTotalGames = 20;
      bonusStats.userTotalAssets = 7;
      bonusStats.assetRank = 25;
      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0.1, 3);
      expect(result.decrease).toBeCloseTo(0.224, 3);
    });
    test('calculates for a fresh server', () => {
      bonusStats.averageTotalGames = 0;
      bonusStats.assetTotalGames = 0;
      bonusStats.averageWins = 0;
      bonusStats.assetWins = 0;
      bonusStats.averageRank = 1;
      bonusStats.assetRank = 0;
      bonusStats.averageTotalAssets = 0;
      bonusStats.userTotalAssets = 0;

      const result: IIncreaseDecrease = dtCoolDownFactory.calculateFactorChancePct(bonusStats);
      expect(result.increase).toBeCloseTo(0.1, 3);
      expect(result.decrease).toBeCloseTo(0.2, 3);
    });
  });
});
