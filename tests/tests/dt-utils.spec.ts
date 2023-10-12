import type { GameBonusData } from '../../src/model/types/daruma-training.js';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { GuildMember } from 'discord.js';

import { AlgoNFTAsset, AlgoNFTAssetRepository } from '../../src/entities/algo-nft-asset.entity.js';
import { Guild } from '../../src/entities/guild.entity.js';
import { User } from '../../src/entities/user.entity.js';
import {
  EMOJI_RENDER_PHASE,
  GameTypes,
  GIF_RENDER_PHASE,
  renderConfig,
  RenderPhase,
} from '../../src/enums/daruma-training.js';
import {
  assetCurrentRank,
  buildGameType,
  calculateFactorChancePct,
  calculateIncAndDec,
  calculateTimePct,
  coolDownsDescending,
  getAverageDarumaOwned,
  getMaxTime,
  getMinTime,
  IIncreaseDecrease,
  karmaPayoutCalculator,
  phaseDelay,
  rollForCoolDown,
} from '../../src/utils/functions/dt-utils.js';
import { mockCustomCache } from '../mocks/mock-custom-cache.js';
import { initORM } from '../utils/bootstrap.js';
import {
  addRandomAssetAndWalletToUser,
  createRandomAsset,
  createRandomUserWithWalletAndAsset,
} from '../utils/test-funcs.js';
jest.mock('../../src/services/custom-cache.js', () => ({
  CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

describe('karmaPayoutCalculator', () => {
  const tokenSettings = {
    baseAmount: 30,
    roundModifier: 5,
    zenMultiplier: 3.5,
    zenRoundModifier: 0.5,
  };

  test('calculates correct payout for a round less than 5 with zen false and payout modifier', () => {
    const winningRound = 4;
    const zen = false;
    const payoutModifier = 1.5;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toEqual(45);
  });

  test('calculates correct payout for a round less than 5 with zen true and payout modifier', () => {
    const winningRound = 4;
    const zen = true;
    const payoutModifier = 1.5;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toEqual(157);
  });

  test('calculates correct payout for a round greater than 5 with zen false and payout modifier', () => {
    const winningRound = 7;
    const zen = false;
    const payoutModifier = 1.5;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toEqual(60);
  });

  test('calculates correct payout for a round greater than 5 with zen true and payout modifier', () => {
    const winningRound = 7;
    const zen = true;
    const payoutModifier = 1.5;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toEqual(270);
  });

  test('calculates correct payout for a round less than 5 with zen false and no payout modifier', () => {
    const winningRound = 4;
    const zen = false;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toEqual(30);
  });

  test('calculates correct payout for a round less than 5 with zen true and no payout modifier', () => {
    const winningRound = 4;
    const zen = true;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toEqual(105);
  });

  test('calculates correct payout for a round greater than 5 with zen false and no payout modifier', () => {
    const winningRound = 7;
    const zen = false;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toEqual(40);
  });

  test('calculates correct payout for a round greater than 5 with zen true and no payout modifier', () => {
    const winningRound = 7;
    const zen = true;
    const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toEqual(180);
  });
});
describe('buildGameType', () => {
  const mockGuild = new Guild();
  const darumaTrainingChannel = {
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 'channel-id',
    messageId: 'message-id',
    guild: mockGuild,
    gameType: GameTypes.OneVsNpc,
  };

  test('calculates correct settings for OneVsNpc', () => {
    const result = buildGameType(darumaTrainingChannel);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: 'channel-id',
      messageId: 'message-id',
      gameType: GameTypes.OneVsNpc,
      coolDown: 21_600_000,
      token: {
        baseAmount: 5,
        roundModifier: 5,
        zenMultiplier: 1,
        zenRoundModifier: 0.5,
      },
    });
  });

  test('calculates correct settings for OneVsOne', () => {
    darumaTrainingChannel.gameType = GameTypes.OneVsOne;
    const result = buildGameType(darumaTrainingChannel);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: 'channel-id',
      messageId: 'message-id',
      gameType: GameTypes.OneVsOne,
      coolDown: 21_600_000,
      token: {
        baseAmount: 20,
        roundModifier: 5,
        zenMultiplier: 1.5,
        zenRoundModifier: 0.5,
      },
    });
  });

  test('calculates correct settings for FourVsNpc', () => {
    darumaTrainingChannel.gameType = GameTypes.FourVsNpc;
    const result = buildGameType(darumaTrainingChannel);
    expect(result).toEqual({
      minCapacity: 5,
      maxCapacity: 5,
      channelId: 'channel-id',
      messageId: 'message-id',
      gameType: GameTypes.FourVsNpc,
      coolDown: 5_400_000,
      token: {
        baseAmount: 30,
        roundModifier: 5,
        zenMultiplier: 3.5,
        zenRoundModifier: 0.5,
      },
    });
  });
});
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
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 4, decrease: 2 });
  });

  test('calculates correct increase and decrease for asset stat below average', () => {
    const assetStat = 2;
    const average = 5;
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 12, decrease: 8 });
  });

  test('calculates correct increase and decrease for asset stat equal to average', () => {
    const assetStat = 5;
    const average = 5;
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 3, decrease: 2 });
  });
  test('calculates correct increase and decrease for asset stat max above', () => {
    const assetStat = 50;
    const average = 5;
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 10, decrease: 5 });
  });
  test('calculates correct increase and decrease for asset stat max below', () => {
    const assetStat = 1;
    const average = 5;
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 15, decrease: 10 });
  });
  test('calculates correct increase and decrease if an assetStat is 0 and average is 1', () => {
    const assetStat = 0;
    const average = 1;
    const result = calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 15, decrease: 10 });
  });
});
describe('calculateTimePct', () => {
  test('should calculate the increase and decrease times correctly', () => {
    const factorPct = { increase: 10, decrease: 5 };
    const channelCoolDown = 60_000;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result.increase).toBeGreaterThan(0);
    expect(result.decrease).toBeGreaterThan(0);
  });
  test('returns for max decrease', () => {
    const factorPct = { increase: 0, decrease: 0.8 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 360,
    });
  });
  test('returns for max increase', () => {
    const factorPct = { increase: 0.3, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 90,
    });
  });
  test('returns 0 for decrease when decreaseMaxChance is 0', () => {
    const factorPct = { increase: 0.3, decrease: 0 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 0,
    });
  });

  test('returns 0 for increase when increaseMaxChance is 0', () => {
    const factorPct = { increase: 0, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 90,
    });
  });

  test('returns correct values for channelCoolDown = 0', () => {
    const factorPct = { increase: 0.3, decrease: 0.2 };
    const channelCoolDown = 0;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 0,
    });
  });

  test('returns correct values for incPct = 0', () => {
    const factorPct = { increase: 0, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 90,
    });
  });

  test('returns correct values for decPct = 0', () => {
    const factorPct = { increase: 0.3, decrease: 0 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 0,
    });
  });
  test('returns correct values incPct and decPct = 0', () => {
    const factorPct = { increase: 0, decrease: 0 };
    const channelCoolDown = 360;

    const result = calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 0,
    });
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
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeGreaterThan(0);
    expect(result.decrease).toBeGreaterThan(0);
  });
  test('calculates for a brand new daruma owner', () => {
    bonusStats.assetTotalGames = 1;
    bonusStats.userTotalAssets = 1;
    bonusStats.assetRank = 1000;
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0, 2);
    expect(result.decrease).toBeCloseTo(0.8, 2);
  });
  test('calculates for a massive owner', () => {
    bonusStats.assetTotalGames = 200;
    bonusStats.userTotalAssets = 80;
    bonusStats.assetRank = 1;
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.3, 2);
    expect(result.decrease).toBeCloseTo(0.2, 2);
  });
  test('calculates for a normal owner', () => {
    bonusStats.assetTotalGames = 10;
    bonusStats.userTotalAssets = 3;
    bonusStats.assetRank = 118;
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.0025, 3);
    expect(result.decrease).toBeCloseTo(0.504, 3);
  });
  test('calculates for a diamond owner', () => {
    bonusStats.assetTotalGames = 40;
    bonusStats.userTotalAssets = 16;
    bonusStats.assetRank = 10;
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.2485, 3);
    expect(result.decrease).toBeCloseTo(0.2, 3);
  });
  test('calculates for a demon owner', () => {
    bonusStats.assetTotalGames = 20;
    bonusStats.userTotalAssets = 7;
    bonusStats.assetRank = 25;
    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
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

    const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.1, 3);
    expect(result.decrease).toBeCloseTo(0.2, 3);
  });
});
describe('asset tests that require db', () => {
  let orm: MikroORM;
  let database: EntityManager;
  let algoNFTAssetRepo: AlgoNFTAssetRepository;
  let user: User;
  let asset: AlgoNFTAsset;
  let memberMock: GuildMember;
  beforeAll(async () => {
    orm = await initORM();
  });
  afterAll(async () => {
    await orm.close(true);
  });
  beforeEach(async () => {
    await orm.schema.clearDatabase();
    database = orm.em.fork();
    algoNFTAssetRepo = database.getRepository(AlgoNFTAsset);
    const newUser = await createRandomUserWithWalletAndAsset(database);
    user = newUser.user;
    asset = newUser.asset.asset;
    memberMock = {
      id: user.id,
    } as GuildMember;
  });
  describe('getAverageDarumaOwned', () => {
    test('returns 0 because no other assets exists', async () => {
      await orm.schema.clearDatabase();
      const result = await getAverageDarumaOwned();
      expect(result).toBe(0);
    });
    test('returns 1 because no matter how many users have 1 its average is 1', async () => {
      await createRandomUserWithWalletAndAsset(database);
      await createRandomUserWithWalletAndAsset(database);
      await createRandomUserWithWalletAndAsset(database);
      const result = await getAverageDarumaOwned();
      expect(result).toBe(1);
    });
    test('returns 2 because a user has 3 assets and 1 has 1', async () => {
      await createRandomUserWithWalletAndAsset(database);
      await addRandomAssetAndWalletToUser(database, user);
      await addRandomAssetAndWalletToUser(database, user);
      const result = await getAverageDarumaOwned();
      expect(result).toBe(2);
    });
  });
  describe('rollForCoolDown', () => {
    test('returns the cooldown sent because no other assets exists', async () => {
      const result = await rollForCoolDown(asset, user.id, 3600, 1, 0);
      expect(result).toBeCloseTo(900);
    });
    test('returns a reduced cooldown because no other assets exist and the roll was good', async () => {
      const result = await rollForCoolDown(asset, user.id, 3600, 0, 1);
      expect(result).toBeCloseTo(4560);
    });
    test('returns the cooldown sent because no other assets exists', async () => {
      const result = await rollForCoolDown(asset, user.id, 3600, 1, 1);
      expect(result).toBeCloseTo(3600);
    });
  });
  describe('assetCurrentRank', () => {
    test('gets the assets current rank when you have no wins or losses', async () => {
      const result = await assetCurrentRank(asset);
      expect(result).toEqual({ currentRank: '0', totalAssets: '0' });
    });
    test('gets the assets current rank when it has some wins and another asset does not', async () => {
      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 1,
        losses: 0,
        zen: 1,
      });
      const result = await assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '1', totalAssets: '1' });
    });
    test('gets the assets current rank when it has some wins and another asset has less wins', async () => {
      await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, {
        wins: 1,
        losses: 1,
        zen: 1,
      });

      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 10,
        losses: 1,
        zen: 1,
      });
      const result = await assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '1', totalAssets: '2' });
    });
    test('gets the assets current rank when it has less wins and another asset has more wins', async () => {
      await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, {
        wins: 10,
        losses: 1,
        zen: 1,
      });

      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const result = await assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '2', totalAssets: '2' });
    });
  });
  describe('coolDownsDescending', () => {
    test('returns an empty array when no assets exist', async () => {
      const result = await coolDownsDescending(memberMock);
      expect(result).toEqual([]);
    });
    test('checks the results when one asset has a cooldown to include the 1 result', async () => {
      const userWithWalletAndAsset = await createRandomUserWithWalletAndAsset(database);
      await algoNFTAssetRepo.assetEndGameUpdate(userWithWalletAndAsset.asset.asset, 50_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const otherMockMember = {
        id: userWithWalletAndAsset.user.id,
      } as GuildMember;

      const result = await coolDownsDescending(otherMockMember);
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(userWithWalletAndAsset.asset.asset.id);
    });
    test('checks the results when 2 assets have a cooldown and they are in the correct order', async () => {
      const userWithWalletAndAsset = await createRandomUserWithWalletAndAsset(database);
      await algoNFTAssetRepo.assetEndGameUpdate(userWithWalletAndAsset.asset.asset, 50_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const otherMockMember = {
        id: userWithWalletAndAsset.user.id,
      } as GuildMember;

      const result = await coolDownsDescending(otherMockMember);
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(userWithWalletAndAsset.asset.asset.id);
      const { asset: asset2 } = await addRandomAssetAndWalletToUser(
        database,
        userWithWalletAndAsset.user,
      );
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 100_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });

      const result2 = await coolDownsDescending(otherMockMember);
      expect(result2).toHaveLength(2);
      expect(result2[0].id).toEqual(asset2.id);
      expect(result2[1].id).toEqual(userWithWalletAndAsset.asset.asset.id);
    });
  });
});
describe('Phase delay logic', () => {
  describe('getMinTime', () => {
    test('should return the correct minTime for FourVsNpc and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMinTime = 1000;

      const result = getMinTime(gameType, phase);

      expect(result).toBe(expectedMinTime);
    });

    test('should return the correct minTime for other gameType and phase', () => {
      const gameType = 'Other' as unknown as GameTypes;
      const phase = 'Other' as unknown as RenderPhase;
      const expectedMinTime = 0;

      const result = getMinTime(gameType, phase);

      expect(result).toBe(expectedMinTime);
    });
    test('should return the set default minTime for FourVsNpc gameType and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMinTime = 1234;

      const result = getMinTime(gameType, phase, expectedMinTime);

      expect(result).toBe(expectedMinTime);
    });
  });

  describe('getMaxTime', () => {
    test('should return the correct maxTime for FourVsNpc and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMaxTime = 1000;

      const result = getMaxTime(gameType, phase);

      expect(result).toBe(expectedMaxTime);
    });

    test('should return the correct maxTime for other gameType and phase', () => {
      const gameType = 'Other' as unknown as GameTypes;
      const phase = 'Other' as unknown as RenderPhase;
      const expectedMaxTime = 0;

      const result = getMaxTime(gameType, phase);

      expect(result).toBe(expectedMaxTime);
    });
    test('should return the set default maxTime for FourVsNpc gameType and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMaxTime = 1234;

      const result = getMaxTime(gameType, phase, expectedMaxTime);

      expect(result).toBe(expectedMaxTime);
    });
  });

  describe('phaseDelay', () => {
    it('should delay execution and return minTime and maxTime', async () => {
      // Arrange
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const executeWait = true;
      const minTime = 1000;
      const maxTime = 1000;
      const randomDelayForMock = jest.fn();

      // Act
      const result = await phaseDelay(gameType, phase, executeWait, randomDelayForMock);

      // Assert
      expect(randomDelayForMock).toHaveBeenCalledWith(minTime, maxTime);
      expect(result).toEqual([minTime, maxTime]);
    });

    it('should not delay execution and return minTime and maxTime', async () => {
      // Arrange
      const gameType = GameTypes.OneVsNpc;
      const phase = GIF_RENDER_PHASE;
      const executeWait = false;
      const minTime = renderConfig[phase]?.durMin ?? 0;
      const maxTime = renderConfig[phase]?.durMax ?? 0;
      const randomDelayForMock = jest.fn();

      // Act
      const result = await phaseDelay(gameType, phase, executeWait, randomDelayForMock);

      // Assert
      expect(randomDelayForMock).not.toHaveBeenCalled();
      expect(result).toEqual([minTime, maxTime]);
    });
    it('should use default values and return minTime and maxTime', async () => {
      // Arrange
      const gameType = GameTypes.OneVsNpc;
      const phase = 'Other' as unknown as RenderPhase;
      const randomDelayForMock = jest.fn();

      // Act
      const result = await phaseDelay(gameType, phase, undefined, randomDelayForMock);

      // Assert
      expect(randomDelayForMock).toHaveBeenCalledWith(0, 0);
      expect(result).toEqual([0, 0]);
    });
    it('should use the default randomDelay function and return minTime and maxTime', async () => {
      // Arrange
      jest.useFakeTimers();
      renderConfig.emoji.durMin = 1;
      renderConfig.emoji.durMax = 500;

      const gameType = GameTypes.OneVsNpc;
      const phase = EMOJI_RENDER_PHASE;

      // Act
      const result = phaseDelay(gameType, phase);
      jest.advanceTimersByTime(500);
      const times = await result;

      // Assert
      expect(times[0]).toBeGreaterThanOrEqual(1);
      expect(times[1]).toBeLessThanOrEqual(500);
      jest.useRealTimers();
    });
  });
});
