import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { DtEncounters, DtEncountersRepository } from '../../src/entities/dt-encounters.entity.js';
import { GameTypes, GameTypesNames } from '../../src/enums/daruma-training.js';
import {
  darumaGameDistributionsPerGameType,
  generateEncounterData,
  nftCountToNumberOfUsers,
  nftHoldersPieChart,
} from '../../src/model/logic/quick-charts.js';
import { initORM } from '../utils/bootstrap.js';
import { addRandomUserToGame, createRandomGame } from '../utils/test-funcs.js';

describe('nftCountToNumUsers', () => {
  it('should correctly convert top NFT holders to NFT count to number of users map', () => {
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
  it('should return expected chart URL', () => {
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
  test('should return expected encounter data', () => {
    // Mock the response from getAllDtEncounters
    const mockGameData: DtEncounters[] = [
      new DtEncounters('channel2', GameTypes.OneVsOne, {
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
      }),
      new DtEncounters('channel2', GameTypes.OneVsOne, {
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
      }),

      new DtEncounters('channel1', GameTypes.OneVsNpc, {
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
      }),
      new DtEncounters('channel3', GameTypes.FourVsNpc, {
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
      }),
    ];
    // Expected result
    const expected = {
      OneVsNpc: [{ rounds: 2, count: 1 }],
      OneVsOne: [{ rounds: 2, count: 2 }],
      FourVsNpc: [{ rounds: 2, count: 1 }],
    };

    const result = generateEncounterData(mockGameData);
    expect(result).toEqual(expected);
  });
});

describe('asset tests that require db', () => {
  let orm: MikroORM;
  let database: EntityManager;
  let dtEncountersRepo: DtEncountersRepository;
  let client: Client;
  let result: [string, string][];
  beforeAll(async () => {
    orm = await initORM();
  });
  afterAll(async () => {
    await orm.close(true);
  });
  beforeEach(() => {
    database = orm.em.fork();
    dtEncountersRepo = database.getRepository(DtEncounters);
    client = container.resolve(Client);
  });
  describe('Create Game Data for quickCharts', () => {
    it('should create a new encounter with multiple players gameData', async () => {
      const randomGame = await createRandomGame(database, client);
      await addRandomUserToGame(database, client, randomGame);
      await addRandomUserToGame(database, client, randomGame);
      await dtEncountersRepo.createEncounter(randomGame);
      result = await darumaGameDistributionsPerGameType();
      expect(result).toHaveLength(3);
      expect(result[0][0]).toEqual(GameTypesNames.OneVsNpc);
      expect(result[1][0]).toEqual(GameTypesNames.OneVsOne);
      expect(result[2][0]).toEqual(GameTypesNames.FourVsNpc);
    });
    it('should pull from cache and still create the same url', async () => {
      const newResult = await darumaGameDistributionsPerGameType();
      expect(newResult).toEqual(result);
    });
  });
});
