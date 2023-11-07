import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import {
  EMOJI_RENDER_PHASE,
  GameTypes,
  GIF_RENDER_PHASE,
  renderConfig,
  RenderPhase,
} from '../../src/enums/daruma-training.js';
import type { GameBonusData, IdtGames } from '../../src/model/types/daruma-training.js';
import * as dtUtils from '../../src/utils/functions/dt-utils.js';
import { mockFakeChannel } from '../utils/fake-mocks.js';

describe('filterCoolDownOrRegistered, filterNotCooledDownOrRegistered', () => {
  test('should return 0 assets when 0 assets is not cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(3000, 1, 1), // 1st of February 3000 (way in the future)
      id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;
    const discordId = 'some-discord-id';
    const games = new Map() as unknown as IdtGames; // fill with appropriate data
    const result = dtUtils.filterCoolDownOrRegistered([daruma], discordId, games);
    expect(result).toEqual([]);
  });
  test('should return 1 assets when 1 assets is cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;
    const discordId = 'some-discord-id';
    const games = new Map() as unknown as IdtGames; // fill with appropriate data
    const result = dtUtils.filterCoolDownOrRegistered([daruma], discordId, games);
    expect(result).toEqual([daruma]);
  });
  test('should return 0 assets when 0 assets is cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;
    const discordId = 'some-discord-id';
    const games = new Map() as unknown as IdtGames; // fill with appropriate data
    const result = dtUtils.filterNotCooledDownOrRegistered([daruma], discordId, games);
    expect(result).toEqual([]);
  });
});
describe('isCoolDownOrRegistered', () => {
  const mockPlayerManager = {
    getPlayer: jest.fn(),
  };
  const mockGame = {
    state: {
      playerManager: mockPlayerManager,
    },
  };
  const mockGames = new Map();
  mockGames.set('game1', mockGame);

  let daruma: AlgoNFTAsset;
  let discordId: string;
  let games: IdtGames;

  beforeEach(() => {
    // Arrange
    daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;
    discordId = 'some-discord-id';
    games = mockGames as unknown as IdtGames; // fill with appropriate data
  });
  it('returns true when cooldown has passed and player is not registered', () => {
    // Act
    const result = dtUtils.isCoolDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(true);
  });

  it('returns false when cooldown has not passed', () => {
    // Arrange
    daruma.dojoCoolDown = new Date(3000, 1, 1); // 1st of February 3000 (way in the future)

    // Act
    const result = dtUtils.isCoolDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });

  it('returns false when player is already registered', () => {
    // Arrange
    const mockPlayer = {
      playableNFT: {
        id: Number(daruma.id),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isCoolDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });

  it('returns false when both conditions are not met', () => {
    // Arrange
    daruma.dojoCoolDown = new Date(3000, 1, 1); // 1st of February 3000 (way in the future)
    const mockPlayer = {
      playableNFT: {
        id: Number(daruma.id),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isCoolDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });
});
describe('isNotCooledDownOrRegistered', () => {
  const mockPlayerManager = {
    getPlayer: jest.fn(),
  };
  const mockGame = {
    state: {
      playerManager: mockPlayerManager,
    },
  };
  const mockGames = new Map();
  mockGames.set('game1', mockGame);

  let daruma: AlgoNFTAsset;
  let discordId: string;
  let games: IdtGames;

  beforeEach(() => {
    // Arrange
    daruma = {
      dojoCoolDown: new Date(3000, 1, 1), // 1st of February 3000 (way in the future)
      id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;
    discordId = 'some-discord-id';
    games = mockGames as unknown as IdtGames; // fill with appropriate data
  });
  it('returns true when cooldown has not passed and player is not registered', () => {
    // Act
    const result = dtUtils.isNotCooledDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(true);
  });

  it('returns false when cooldown has passed', () => {
    // Arrange
    daruma.dojoCoolDown = new Date(2020, 1, 1); // 1st of February 2020 (way in the past)

    // Act
    const result = dtUtils.isNotCooledDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });

  it('returns false when player is already registered', () => {
    // Arrange
    const mockPlayer = {
      playableNFT: {
        id: Number(daruma.id),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isNotCooledDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });

  it('returns false when both conditions are not met', () => {
    // Arrange
    daruma.dojoCoolDown = new Date(2020, 1, 1); // 1st of February 2020 (way in the past)
    const mockPlayer = {
      playableNFT: {
        id: Number(daruma.id),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isNotCooledDownOrRegistered(daruma, discordId, games);

    // Assert
    expect(result).toBe(false);
  });
});

describe('filterDarumaIndex', () => {
  // Define a mock filter function for testing
  const mockFilterFunction = jest.fn((_daruma, _discordId, _games) => true);

  // Reset the mock function before each test
  beforeEach(() => {
    mockFilterFunction.mockClear();
  });

  // Happy path test
  test('should correctly filter daruma index', () => {
    // Arrange
    const darumaIndex = [{}, {}, {}] as unknown as AlgoNFTAsset[]; // Replace with realistic AlgoNFTAsset objects
    const discordId = '123456';
    const games = {} as unknown as IdtGames; // Replace with realistic IdtGames object

    // Act
    const result = dtUtils.filterDarumaIndex(darumaIndex, discordId, games, mockFilterFunction);

    // Assert
    expect(result).toEqual(darumaIndex);
    expect(mockFilterFunction).toHaveBeenCalledTimes(3);
  });

  // Edge case: Empty daruma index
  test('should return an empty array when daruma index is empty', () => {
    // Arrange
    const darumaIndex = [];
    const discordId = '123456';
    const games = {} as unknown as IdtGames; // Replace with realistic IdtGames object

    // Act
    const result = dtUtils.filterDarumaIndex(darumaIndex, discordId, games, mockFilterFunction);

    // Assert
    expect(result).toEqual([]);
    expect(mockFilterFunction).not.toHaveBeenCalled();
  });

  // Error case: No filter function provided
  test('should throw an error when no filter function is provided', () => {
    // Arrange
    const darumaIndex = [{}, {}, {}] as unknown as AlgoNFTAsset[]; // Replace with realistic AlgoNFTAsset objects
    const discordId = '123456';
    const games = {} as unknown as IdtGames; // Replace with realistic IdtGames object

    // Act and Assert
    expect(() => dtUtils.filterDarumaIndex(darumaIndex, discordId, games, null)).toThrow();
  });
});

describe('checkIfRegisteredPlayer', () => {
  // Mock the PlayerManager and IdtGames objects
  const mockPlayerManager = {
    getPlayer: jest.fn(),
  };
  const mockGame = {
    state: {
      playerManager: mockPlayerManager,
    },
  };
  const mockGames = new Map();
  mockGames.set('game1', mockGame);
  // Happy path test
  test('should return true if the player is registered', () => {
    // Arrange
    const discordUser = 'user1';
    const assetId = '123';
    const mockPlayer = {
      playableNFT: {
        id: Number(assetId),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordUser, assetId);

    // Assert
    expect(result).toBe(true);
  });

  // Edge case: player is not registered
  test('should return false if the player is not registered', () => {
    // Arrange
    const discordUser = 'user2';
    const assetId = '456';
    mockPlayerManager.getPlayer.mockReturnValue(null);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordUser, assetId);

    // Assert
    expect(result).toBe(false);
  });

  // Error case: assetId does not match
  test('should return false if the assetId does not match', () => {
    // Arrange
    const discordUser = 'user3';
    const assetId = '789';
    const mockPlayer = {
      playableNFT: {
        id: 999, // Different from assetId
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordUser, assetId);

    // Assert
    expect(result).toBe(false);
  });
});
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
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toBe(45);
  });

  test('calculates correct payout for a round less than 5 with zen true and payout modifier', () => {
    const winningRound = 4;
    const zen = true;
    const payoutModifier = 1.5;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toBe(157);
  });

  test('calculates correct payout for a round greater than 5 with zen false and payout modifier', () => {
    const winningRound = 7;
    const zen = false;
    const payoutModifier = 1.5;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toBe(60);
  });

  test('calculates correct payout for a round greater than 5 with zen true and payout modifier', () => {
    const winningRound = 7;
    const zen = true;
    const payoutModifier = 1.5;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen, payoutModifier);
    expect(result).toBe(270);
  });

  test('calculates correct payout for a round less than 5 with zen false and no payout modifier', () => {
    const winningRound = 4;
    const zen = false;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toBe(30);
  });

  test('calculates correct payout for a round less than 5 with zen true and no payout modifier', () => {
    const winningRound = 4;
    const zen = true;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toBe(105);
  });

  test('calculates correct payout for a round greater than 5 with zen false and no payout modifier', () => {
    const winningRound = 7;
    const zen = false;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toBe(40);
  });

  test('calculates correct payout for a round greater than 5 with zen true and no payout modifier', () => {
    const winningRound = 7;
    const zen = true;
    const result = dtUtils.karmaPayoutCalculator(winningRound, tokenSettings, zen);
    expect(result).toBe(180);
  });
});
describe('buildGameType', () => {
  const oneVsNPC = mockFakeChannel(GameTypes.OneVsNpc);
  const oneVsOne = mockFakeChannel(GameTypes.OneVsOne);
  const fourVsNPC = mockFakeChannel(GameTypes.FourVsNpc);
  test('calculates correct settings for OneVsNpc', () => {
    const result = dtUtils.buildGameType(oneVsNPC);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: 'channel-id',
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
    const result = dtUtils.buildGameType(oneVsOne);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: 'channel-id',
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
    const result = dtUtils.buildGameType(fourVsNPC);
    expect(result).toEqual({
      minCapacity: 5,
      maxCapacity: 5,
      channelId: 'channel-id',
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
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 4, decrease: 2 });
  });

  test('calculates correct increase and decrease for asset stat below average', () => {
    const assetStat = 2;
    const average = 5;
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 12, decrease: 8 });
  });

  test('calculates correct increase and decrease for asset stat equal to average', () => {
    const assetStat = 5;
    const average = 5;
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 3, decrease: 2 });
  });
  test('calculates correct increase and decrease for asset stat max above', () => {
    const assetStat = 50;
    const average = 5;
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 10, decrease: 5 });
  });
  test('calculates correct increase and decrease for asset stat max below', () => {
    const assetStat = 1;
    const average = 5;
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 15, decrease: 10 });
  });
  test('calculates correct increase and decrease if an assetStat is 0 and average is 1', () => {
    const assetStat = 0;
    const average = 1;
    const result = dtUtils.calculateIncAndDec(medianMaxes, assetStat, average);
    expect(result).toEqual({ increase: 15, decrease: 10 });
  });
});
describe('calculateTimePct', () => {
  test('should calculate the increase and decrease times correctly', () => {
    const factorPct = { increase: 10, decrease: 5 };
    const channelCoolDown = 60_000;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result.increase).toBeGreaterThan(0);
    expect(result.decrease).toBeGreaterThan(0);
  });
  test('returns for max decrease', () => {
    const factorPct = { increase: 0, decrease: 0.8 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 360,
    });
  });
  test('returns for max increase', () => {
    const factorPct = { increase: 0.3, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 90,
    });
  });
  test('returns 0 for decrease when decreaseMaxChance is 0', () => {
    const factorPct = { increase: 0.3, decrease: 0 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 0,
    });
  });

  test('returns 0 for increase when increaseMaxChance is 0', () => {
    const factorPct = { increase: 0, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 90,
    });
  });

  test('returns correct values for channelCoolDown = 0', () => {
    const factorPct = { increase: 0.3, decrease: 0.2 };
    const channelCoolDown = 0;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 0,
    });
  });

  test('returns correct values for incPct = 0', () => {
    const factorPct = { increase: 0, decrease: 0.2 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 90,
    });
  });

  test('returns correct values for decPct = 0', () => {
    const factorPct = { increase: 0.3, decrease: 0 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 288,
      decrease: 0,
    });
  });
  test('returns correct values incPct and decPct = 0', () => {
    const factorPct = { increase: 0, decrease: 0 };
    const channelCoolDown = 360;

    const result = dtUtils.calculateTimePct(factorPct, channelCoolDown);

    expect(result).toEqual({
      increase: 0,
      decrease: 0,
    });
  });
});
describe('coolDownRolls', () => {
  test('returns the inputs and does not use the random function', () => {
    const mockFunction = jest.fn().mockReturnValue(1);
    const result = dtUtils.coolDownRolls(mockFunction);
    expect(result).toEqual({ increaseRoll: 1, decreaseRoll: 1 });
  });
  test('returns the inputs and uses the random function for increase', () => {
    const mockFunction = jest.fn().mockReturnValue(0);
    const result = dtUtils.coolDownRolls(mockFunction);
    expect(result).toEqual({ increaseRoll: 0, decreaseRoll: 0 });
    expect(mockFunction).toHaveBeenCalled();
  });
  test('checks that it uses the default random function', () => {
    const result = dtUtils.coolDownRolls();
    expect(result).toBeDefined();
    expect(result.decreaseRoll).toBeGreaterThanOrEqual(0);
    expect(result.increaseRoll).toBeGreaterThanOrEqual(0);
  });
});
describe('rollForCoolDown', () => {
  const asset = {} as unknown as AlgoNFTAsset;
  const user = {
    id: 'some-discord-id',
  };
  const channelCooldown = 3600;
  const factorChancePctFunction = jest.fn().mockReturnValue({ increase: 0, decrease: 0 });
  const coolDownRollsFunction = jest.fn().mockReturnValue({ increaseRoll: 0, decreaseRoll: 0 });
  test('returns the cooldown sent', async () => {
    const result = await dtUtils.rollForCoolDown(
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
    const result = await dtUtils.rollForCoolDown(
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
    const result = await dtUtils.rollForCoolDown(
      asset,
      user.id,
      channelCooldown,
      coolDownRollsFunction,
      factorChancePctFunction,
    );
    expect(result).toBeCloseTo(3150);
  });
  test('checks to see if it calls the random function', async () => {
    const result = await dtUtils.rollForCoolDown(
      asset,
      user.id,
      channelCooldown,
      undefined,
      factorChancePctFunction,
    );
    expect(result).toBeDefined();
  });
  test('should throw an error with no factorChancePctFunction', async () => {
    await expect(
      dtUtils.rollForCoolDown(asset, user.id, channelCooldown, coolDownRollsFunction),
    ).rejects.toThrow();
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
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeGreaterThan(0);
    expect(result.decrease).toBeGreaterThan(0);
  });
  test('calculates for a brand new daruma owner', () => {
    bonusStats.assetTotalGames = 1;
    bonusStats.userTotalAssets = 1;
    bonusStats.assetRank = 1000;
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0, 2);
    expect(result.decrease).toBeCloseTo(0.8, 2);
  });
  test('calculates for a massive owner', () => {
    bonusStats.assetTotalGames = 200;
    bonusStats.userTotalAssets = 80;
    bonusStats.assetRank = 1;
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.3, 2);
    expect(result.decrease).toBeCloseTo(0.2, 2);
  });
  test('calculates for a normal owner', () => {
    bonusStats.assetTotalGames = 10;
    bonusStats.userTotalAssets = 3;
    bonusStats.assetRank = 118;
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.0025, 3);
    expect(result.decrease).toBeCloseTo(0.504, 3);
  });
  test('calculates for a diamond owner', () => {
    bonusStats.assetTotalGames = 40;
    bonusStats.userTotalAssets = 16;
    bonusStats.assetRank = 10;
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.2485, 3);
    expect(result.decrease).toBeCloseTo(0.2, 3);
  });
  test('calculates for a demon owner', () => {
    bonusStats.assetTotalGames = 20;
    bonusStats.userTotalAssets = 7;
    bonusStats.assetRank = 25;
    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
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

    const result: dtUtils.IIncreaseDecrease = dtUtils.calculateFactorChancePct(bonusStats);
    expect(result.increase).toBeCloseTo(0.1, 3);
    expect(result.decrease).toBeCloseTo(0.2, 3);
  });
});
describe('Phase delay logic', () => {
  describe('getMinTime', () => {
    test('should return the correct minTime for FourVsNpc and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMinTime = 1000;

      const result = dtUtils.getMinTime(gameType, phase);

      expect(result).toBe(expectedMinTime);
    });

    test('should return the correct minTime for other gameType and phase', () => {
      const gameType = 'Other' as unknown as GameTypes;
      const phase = 'Other' as unknown as RenderPhase;
      const expectedMinTime = 0;

      const result = dtUtils.getMinTime(gameType, phase);

      expect(result).toBe(expectedMinTime);
    });
    test('should return the set default minTime for FourVsNpc gameType and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMinTime = 1234;

      const result = dtUtils.getMinTime(gameType, phase, expectedMinTime);

      expect(result).toBe(expectedMinTime);
    });
  });

  describe('getMaxTime', () => {
    test('should return the correct maxTime for FourVsNpc and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMaxTime = 1000;

      const result = dtUtils.getMaxTime(gameType, phase);

      expect(result).toBe(expectedMaxTime);
    });

    test('should return the correct maxTime for other gameType and phase', () => {
      const gameType = 'Other' as unknown as GameTypes;
      const phase = 'Other' as unknown as RenderPhase;
      const expectedMaxTime = 0;

      const result = dtUtils.getMaxTime(gameType, phase);

      expect(result).toBe(expectedMaxTime);
    });
    test('should return the set default maxTime for FourVsNpc gameType and GIF_RENDER_PHASE', () => {
      const gameType = GameTypes.FourVsNpc;
      const phase = GIF_RENDER_PHASE;
      const expectedMaxTime = 1234;

      const result = dtUtils.getMaxTime(gameType, phase, expectedMaxTime);

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
      const result = await dtUtils.phaseDelay(gameType, phase, executeWait, randomDelayForMock);

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
      const result = await dtUtils.phaseDelay(gameType, phase, executeWait, randomDelayForMock);

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
      const result = await dtUtils.phaseDelay(gameType, phase, undefined, randomDelayForMock);

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
      const result = dtUtils.phaseDelay(gameType, phase);
      jest.advanceTimersByTime(500);
      const times = await result;

      // Assert
      expect(times[0]).toBeGreaterThanOrEqual(1);
      expect(times[1]).toBeLessThanOrEqual(500);
      jest.useRealTimers();
    });
  });
});
