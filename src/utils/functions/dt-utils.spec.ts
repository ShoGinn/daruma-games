import { mockedFakeStdAsset, mockFakeChannel } from '../../../tests/mocks/mock-functions.js';
import { generateDiscordId } from '../../../tests/setup/test-funcs.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import {
  EMOJI_RENDER_PHASE,
  GameTypes,
  GIF_RENDER_PHASE,
  renderConfig,
  RenderPhase,
} from '../../enums/daruma-training.js';
import { ChannelTokenSettings, IdtGames } from '../../types/daruma-training.js';

import * as dtUtils from './dt-utils.js';

const discordId = generateDiscordId();
const mockGameAsset = mockedFakeStdAsset();
describe('filterCoolDownOrRegistered, filterNotCooledDownOrRegistered', () => {
  test('should return 0 assets when 0 assets is not cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(3000, 1, 1), // 1st of February 3000 (way in the future)
      _id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;

    const games = new Map() as unknown as IdtGames; // fill with appropriate data
    const result = dtUtils.filterCoolDownOrRegistered([daruma], discordId, games);
    expect(result).toEqual([]);
  });
  test('should return 1 assets when 1 assets is cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      _id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;

    const games = new Map() as unknown as IdtGames; // fill with appropriate data
    const result = dtUtils.filterCoolDownOrRegistered([daruma], discordId, games);
    expect(result).toEqual([daruma]);
  });
  test('should return 0 assets when 0 assets is cooled down', () => {
    const daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      _id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;

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

  let games: IdtGames;

  beforeEach(() => {
    // Arrange
    daruma = {
      dojoCoolDown: new Date(2020, 1, 1), // 1st of February 2020 (way in the past)
      _id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;

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
        _id: Number(daruma._id),
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
        _id: Number(daruma._id),
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

  let games: IdtGames;

  beforeEach(() => {
    // Arrange
    daruma = {
      dojoCoolDown: new Date(3000, 1, 1), // 1st of February 3000 (way in the future)
      _id: 123,
      // other properties...
    } as unknown as AlgoNFTAsset;

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
        _id: Number(daruma._id),
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
        _id: Number(daruma._id),
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
    const darumaIndex: AlgoNFTAsset[] = [];

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

    const games = {} as unknown as IdtGames; // Replace with realistic IdtGames object
    const mockFilterFunction = jest.fn().mockImplementation(() => {
      throw new Error('Filter function error');
    });
    // Act and Assert
    expect(() =>
      dtUtils.filterDarumaIndex(darumaIndex, discordId, games, mockFilterFunction),
    ).toThrow();
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

    const assetId = '123';
    const mockPlayer = {
      playableNFT: {
        _id: Number(assetId),
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordId, assetId);

    // Assert
    expect(result).toBe(true);
  });

  // Edge case: player is not registered
  test('should return false if the player is not registered', () => {
    // Arrange

    const assetId = '456';
    mockPlayerManager.getPlayer.mockReturnValue(null);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordId, assetId);

    // Assert
    expect(result).toBe(false);
  });

  // Error case: assetId does not match
  test('should return false if the assetId does not match', () => {
    // Arrange

    const assetId = '789';
    const mockPlayer = {
      playableNFT: {
        id: 999, // Different from assetId
      },
    };
    mockPlayerManager.getPlayer.mockReturnValue(mockPlayer);

    // Act
    const result = dtUtils.isPlayerAssetRegisteredInGames(mockGames, discordId, assetId);

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
  } as ChannelTokenSettings;

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
    const result = dtUtils.buildGameType(oneVsNPC, mockGameAsset);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: oneVsNPC._id,
      gameType: GameTypes.OneVsNpc,
      coolDown: 21_600_000,
      token: {
        gameAsset: mockGameAsset,
        baseAmount: 5,
        roundModifier: 5,
        zenMultiplier: 1,
        zenRoundModifier: 0.5,
      },
    });
  });

  test('calculates correct settings for OneVsOne', () => {
    const result = dtUtils.buildGameType(oneVsOne, mockGameAsset);
    expect(result).toEqual({
      minCapacity: 2,
      maxCapacity: 2,
      channelId: oneVsOne._id,
      gameType: GameTypes.OneVsOne,
      coolDown: 21_600_000,
      token: {
        gameAsset: mockGameAsset,
        baseAmount: 20,
        roundModifier: 5,
        zenMultiplier: 1.5,
        zenRoundModifier: 0.5,
      },
    });
  });

  test('calculates correct settings for FourVsNpc', () => {
    const result = dtUtils.buildGameType(fourVsNPC, mockGameAsset);
    expect(result).toEqual({
      minCapacity: 5,
      maxCapacity: 5,
      channelId: fourVsNPC._id,
      gameType: GameTypes.FourVsNpc,
      coolDown: 5_400_000,
      token: {
        gameAsset: mockGameAsset,
        baseAmount: 30,
        roundModifier: 5,
        zenMultiplier: 3.5,
        zenRoundModifier: 0.5,
      },
    });
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
