import { instance, mock, when } from 'ts-mockito';

import {
  fourVsNpcPlayerWinner,
  oneVsNpcNpcWinner,
  oneVsOneZen,
} from '../../tests/mocks/mock-encounters-data.js';
import { mockedFakeUser } from '../../tests/mocks/mock-functions.js';
import { DarumaTrainingEncounters } from '../database/dt-encounter/dt-encounters.schema.js';
import { WalletAddress } from '../types/core.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import {
  DarumaTrainingChampions,
  IChampion,
  IChampionEmbed,
  IPulledChampions,
} from './dt-champions.js';
import { DarumaTrainingEncountersService } from './dt-encounters.js';
import { UserService } from './user.js';

describe('DarumaTrainingChampions', () => {
  let encounterService: DarumaTrainingEncountersService;
  let userService: UserService;
  let algoNFTServer: AlgoNFTAssetService;
  let champions: DarumaTrainingChampions;
  const date = new Date();

  const champion1: IChampion = {
    assetNumber: 1,
    ownerWallet: 'wallet1' as WalletAddress,
    databaseUser: mockedFakeUser(),
  };
  const champion2: IChampion = {
    assetNumber: 2,
    ownerWallet: 'wallet2' as WalletAddress,
    databaseUser: mockedFakeUser(),
  };
  const pulledChampions0: IPulledChampions = {
    championDate: date,
    totalChampions: 0,
    championsAssets: [],
  };
  const pulledChampions1: IPulledChampions = {
    championDate: date,
    totalChampions: 1,
    championsAssets: [champion1.assetNumber],
  };
  const pulledChampions2: IPulledChampions = {
    championDate: date,
    totalChampions: 2,
    championsAssets: [champion1.assetNumber, champion2.assetNumber],
  };
  const championEmbed0: IChampionEmbed = {
    pulledChampions: pulledChampions0,
    champions: [],
  };
  const championEmbed1: IChampionEmbed = {
    pulledChampions: pulledChampions1,
    champions: [champion1],
  };
  const championEmbed2: IChampionEmbed = {
    pulledChampions: pulledChampions2,
    champions: [champion1, champion2],
  };

  beforeEach(() => {
    encounterService = mock(DarumaTrainingEncountersService);
    userService = mock(UserService);
    algoNFTServer = mock(AlgoNFTAssetService);
    champions = new DarumaTrainingChampions(
      instance(encounterService),
      instance(userService),
      instance(algoNFTServer),
    );
  });
  describe('getRandomNumberOfChampionsByDate', () => {
    it('should return the correct number of champions for a fourVsNpcPlayerWinner', async () => {
      const encounters = [fourVsNpcPlayerWinner];
      when(encounterService.getAllByDate(date)).thenResolve(encounters);

      const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

      // Replace with the expected champions
      const expectedChampions = [40_001];
      const expectedResult = {
        championDate: date,
        totalChampions: 1,
        championsAssets: expectedChampions,
      };
      expect(result).toMatchObject(expectedResult);
    });

    it('should return the correct champions for a oneVsOneZen', async () => {
      const encounters: DarumaTrainingEncounters[] = [oneVsOneZen];
      when(encounterService.getAllByDate(date)).thenResolve(encounters);

      const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

      // Replace with the expected champions
      const expectedChampions = [11_001, 11_002];
      const expectedResult = {
        championDate: date,
        totalChampions: 2,
        championsAssets: expectedChampions.sort(),
      };
      expect(result).toMatchObject(expectedResult);
    });
    it('should return the correct champions for a oneVsNpcNpcWinner', async () => {
      const encounters: DarumaTrainingEncounters[] = [oneVsNpcNpcWinner];
      when(encounterService.getAllByDate(date)).thenResolve(encounters);

      const result = await champions.getRandomNumberOfChampionsByDate(date, 3);
      const expectedResult = {
        championDate: date,
        totalChampions: 0,
        championsAssets: [],
      };
      expect(result).toMatchObject(expectedResult);
    });
    it('should return the correct length of champions for all the mock data no dupes', async () => {
      const encounters: DarumaTrainingEncounters[] = [
        oneVsNpcNpcWinner,
        oneVsOneZen,
        fourVsNpcPlayerWinner,
        oneVsOneZen,
        fourVsNpcPlayerWinner,
      ];
      when(encounterService.getAllByDate(date)).thenResolve(encounters);

      const result = await champions.getRandomNumberOfChampionsByDate(date, 3);

      // Replace with the expected champions
      const expectedChampions = [40_001, 11_001, 11_002];
      const expectedResult = {
        championDate: date,
        totalChampions: 3,
        championsAssets: expectedChampions.sort(),
      };
      expect(result).toMatchObject(expectedResult);
    });
  });
  describe('buildChampionEmbed', () => {
    it('should build the champion embed correctly for 0 champions', async () => {
      // Act
      const result = await champions.buildChampionEmbed(championEmbed0);

      // Assert
      const expectedResult = `No Champions for Date: \`${date.toISOString()}\``;
      expect(result).toBe(expectedResult);
    });
    it('should build the champion embed correctly for 1 champion', async () => {
      // Act
      const result = await champions.buildChampionEmbed(championEmbed1);

      // Assert
      const expectedResult = `\`1\` Random Champions Picked for Date: \`${date.toISOString()}\`\n\nTotal Champions Who Played During That Period: \`1\`\n\nDaruma Asset#: \`1\`\nDiscord User: <@${champion1.databaseUser._id}>\nOwner Wallet: \`wallet1\`\n\n`;
      expect(result).toBe(expectedResult);
    });
    it('should build the champion embed correctly for 2 champions', async () => {
      // Act
      const result = await champions.buildChampionEmbed(championEmbed2);

      // Assert
      const expectedResult = `\`2\` Random Champions Picked for Date: \`${date.toISOString()}\`\n\nTotal Champions Who Played During That Period: \`2\`\n\nDaruma Asset#: \`1\`\nDiscord User: <@${champion1.databaseUser._id}>\nOwner Wallet: \`wallet1\`\n\n\nDaruma Asset#: \`2\`\nDiscord User: <@${champion2.databaseUser._id}>\nOwner Wallet: \`wallet2\`\n\n`;
      expect(result).toBe(expectedResult);
    });
  });

  describe('createChampion', () => {
    it('should create the champion correctly', async () => {
      // Act
      when(algoNFTServer.getOwnerWalletFromAssetIndex(champion1.assetNumber)).thenResolve(
        champion1.ownerWallet,
      );
      when(userService.getUserByWallet(champion1.ownerWallet)).thenResolve(champion1.databaseUser);
      const result = await champions.createChampion(champion1.assetNumber);

      // Assert
      expect(result).toEqual(champion1);
    });
    it('should return null if the champion is not found', async () => {
      // Act
      when(algoNFTServer.getOwnerWalletFromAssetIndex(champion1.assetNumber)).thenReject(
        new Error('not found'),
      );
      const result = await champions.createChampion(champion1.assetNumber);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('createChampionRecord', () => {
    it('should create the champion record correctly', async () => {
      // Arrange
      when(algoNFTServer.getOwnerWalletFromAssetIndex(champion1.assetNumber)).thenResolve(
        champion1.ownerWallet,
      );
      when(userService.getUserByWallet(champion1.ownerWallet)).thenResolve(champion1.databaseUser);

      // Act
      const result = await champions.createChampionRecord(pulledChampions1);

      // Assert
      expect(result).toEqual(championEmbed1);
    });
  });
});
