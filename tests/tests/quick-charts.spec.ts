import { IDarumaTrainingEncounters } from '../../src/entities/dt-encounters.mongo.js';
import { GameTypes, GameTypesNames } from '../../src/enums/daruma-training.js';
import {
  darumaGameDistributionsPerGameType,
  generateEncounterData,
  getRoundsDistributionPerGameTypeData,
  nftCountToNumberOfUsers,
  nftHoldersPieChart,
} from '../../src/model/logic/quick-charts.js';
import { mockCustomCache } from '../mocks/mock-custom-cache.js';
jest.mock('../../src/entities/dt-encounters.mongo.js', () => ({
  getAllDtEncounters: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/custom-cache.js', () => ({
  CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

describe('nftCountToNumUsers', () => {
  test('should correctly convert top NFT holders to NFT count to number of users map', () => {
    const topNFTHolders = new Map<string, number>([
      ['user1', 2],
      ['user2', 1],
      ['user3', 2],
      ['user4', 3],
      ['user5', 3],
      ['user6', 0],
    ]);

    const result = nftCountToNumberOfUsers(topNFTHolders);

    expect(result).toEqual(
      new Map<number, number>([
        [2, 2],
        [1, 1],
        [3, 2],
      ]),
    );
  });
});
describe('nftHolderPieChart', () => {
  test('should return expected chart URL', () => {
    const topNFTHolders = new Map<string, number>([
      ['user1', 2],
      ['user2', 1],
      ['user3', 2],
      ['user4', 3],
      ['user5', 3],
      ['user6', 0],
    ]);

    const chartUrl = nftHoldersPieChart(topNFTHolders);
    expect(chartUrl).toBe(
      'https://quickchart.io/chart?bkg=%23ffffff&c=%7B%22type%22%3A%22doughnut%22%2C%22options%22%3A%7B%22legend%22%3A%7B%22display%22%3Atrue%2C%22position%22%3A%22left%22%2C%22align%22%3A%22start%22%2C%22fullWidth%22%3Atrue%2C%22reverse%22%3Afalse%2C%22labels%22%3A%7B%22fontSize%22%3A8%2C%22fontFamily%22%3A%22sans-serif%22%2C%22fontColor%22%3A%22%23666666%22%2C%22fontStyle%22%3A%22normal%22%2C%22padding%22%3A10%7D%7D%7D%2C%22data%22%3A%7B%22labels%22%3A%5B%222%20wallets%20with%202%20Darumas%22%2C%221%20wallets%20with%201%20Darumas%22%2C%222%20wallets%20with%203%20Darumas%22%5D%2C%22datasets%22%3A%5B%7B%22data%22%3A%5B2%2C1%2C2%5D%7D%5D%7D%7D&w=800&h=600',
    );
  });
});
describe('generateEncounterData', () => {
  // Mock the response from getAllDtEncounters
  const mockGameData = [
    {
      channelId: 'channel2',
      gameType: GameTypes.OneVsOne,
      gameData: {
        player1: {
          rounds: [
            {
              rolls: [
                { roll: 10, damage: 5, totalScore: 15 },
                { roll: 20, damage: 10, totalScore: 30 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
        player2: {
          rounds: [
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 15, damage: 7, totalScore: 22 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
      },
    },
    {
      channelId: 'channel2',
      gameType: GameTypes.OneVsOne,
      gameData: {
        player1: {
          rounds: [
            {
              rolls: [
                { roll: 10, damage: 5, totalScore: 15 },
                { roll: 20, damage: 10, totalScore: 30 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
        player2: {
          rounds: [
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 15, damage: 7, totalScore: 22 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
      },
    },
    {
      channelId: 'channel1',
      gameType: GameTypes.OneVsNpc,
      gameData: {
        player1: {
          rounds: [
            {
              rolls: [
                { roll: 10, damage: 5, totalScore: 15 },
                { roll: 20, damage: 10, totalScore: 30 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
        npc: {
          rounds: [
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 15, damage: 7, totalScore: 22 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
      },
    },
    {
      channelId: 'channel3',
      gameType: GameTypes.FourVsNpc,
      gameData: {
        player1: {
          rounds: [
            {
              rolls: [
                { roll: 10, damage: 5, totalScore: 15 },
                { roll: 20, damage: 10, totalScore: 30 },
              ],
            },
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 15, damage: 7, totalScore: 22 },
              ],
            },
          ],
          gameWinRoundIndex: 2,
          gameWinRollIndex: 1,
        },
        player2: {
          rounds: [
            {
              rolls: [
                { roll: 3, damage: 1, totalScore: 4 },
                { roll: 7, damage: 3, totalScore: 10 },
              ],
            },
            {
              rolls: [
                { roll: 15, damage: 5, totalScore: 20 },
                { roll: 18, damage: 7, totalScore: 25 },
              ],
            },
          ],
          gameWinRoundIndex: 1,
          gameWinRollIndex: 1,
        },
        npc: {
          rounds: [
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 10, damage: 5, totalScore: 15 },
              ],
            },
            {
              rolls: [
                { roll: 2, damage: 1, totalScore: 3 },
                { roll: 7, damage: 3, totalScore: 10 },
              ],
            },
          ],
          gameWinRoundIndex: 2,
          gameWinRollIndex: 1,
        },
        player3: {
          rounds: [
            {
              rolls: [
                { roll: 2, damage: 1, totalScore: 3 },
                { roll: 7, damage: 3, totalScore: 10 },
              ],
            },
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 10, damage: 5, totalScore: 15 },
              ],
            },
          ],
          gameWinRoundIndex: 2,
          gameWinRollIndex: 1,
        },
        player4: {
          rounds: [
            {
              rolls: [
                { roll: 10, damage: 5, totalScore: 15 },
                { roll: 20, damage: 10, totalScore: 30 },
              ],
            },
            {
              rolls: [
                { roll: 5, damage: 2, totalScore: 7 },
                { roll: 15, damage: 7, totalScore: 22 },
              ],
            },
          ],
          gameWinRoundIndex: 2,
          gameWinRollIndex: 1,
        },
      },
    },
  ] as unknown as IDarumaTrainingEncounters[];
  const expected = {
    OneVsNpc: [{ rounds: 2, count: 1 }],
    OneVsOne: [{ rounds: 2, count: 2 }],
    FourVsNpc: [{ rounds: 2, count: 1 }],
  };

  test('should return expected encounter data', () => {
    // Expected result

    const result = generateEncounterData(mockGameData);
    expect(result).toEqual(expected);
  });
  describe('darumaGameDistributionsPerGameType', () => {
    test('should return expected result', async () => {
      const result = await darumaGameDistributionsPerGameType(expected);
      expect(result[0][0]).toEqual(GameTypesNames.OneVsNpc);
      expect(result[1][0]).toEqual(GameTypesNames.OneVsOne);
      expect(result[2][0]).toEqual(GameTypesNames.FourVsNpc);
    });
    test('should return the null when encounter data is not provided', async () => {
      const result = await darumaGameDistributionsPerGameType();
      expect(result[0][0]).toEqual(GameTypesNames.OneVsNpc);
      expect(result[1][0]).toEqual(GameTypesNames.OneVsOne);
      expect(result[2][0]).toEqual(GameTypesNames.FourVsNpc);
    });
  });
  describe('getRoundsDistributionPerGameTypeData', () => {
    test('should use the default mongo function and return []', async () => {
      const result = await getRoundsDistributionPerGameTypeData();
      expect(result).toEqual({ FourVsNpc: [], OneVsNpc: [], OneVsOne: [] });
    });
    test('should return expected result', async () => {
      const mockGameDataFunction = jest.fn().mockResolvedValue(mockGameData);
      const result = await getRoundsDistributionPerGameTypeData(mockGameDataFunction);
      expect(result).toEqual(expected);
      expect(mockGameDataFunction).toHaveBeenCalledTimes(1);
    });
    test('should return expected result when cache is set', async () => {
      mockCustomCache.get = jest.fn().mockResolvedValue(expected);
      const mockGameDataFunction = jest.fn().mockResolvedValue(mockGameData);
      const result = await getRoundsDistributionPerGameTypeData(mockGameDataFunction);
      expect(result).toEqual(expected);
      expect(mockGameDataFunction).toHaveBeenCalledTimes(0);
    });
  });
});
