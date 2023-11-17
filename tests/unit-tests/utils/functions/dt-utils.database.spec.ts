import { GuildMember } from 'discord.js';

import { anything, instance, mock, when } from 'ts-mockito';
import { container } from 'tsyringe';

import { AlgoNFTAssetService } from '../../../../src/services/algo-nft-assets.js';
import * as CustomCache from '../../../../src/services/custom-cache.js';
import { StatsService } from '../../../../src/services/stats.js';
import { DiscordId } from '../../../../src/types/core.js';
import * as dtUtils from '../../../../src/utils/functions/dt-utils.js';
import { mockCustomCache } from '../../../mocks/mock-custom-cache.js';
import { mockedFakeAlgoNFTAsset } from '../../../setup/fake-mocks.js';

describe('asset tests that require db', () => {
  jest.spyOn(CustomCache, 'CustomCache').mockImplementation(() => mockCustomCache);
  let mockedAsset;
  let mockedAsset2;
  let mockedStatsService: StatsService;
  let mockedAlgoNFTAssetService: AlgoNFTAssetService;
  const mockedGuildMember = {
    id: '123456789',
  } as GuildMember;

  beforeEach(() => {
    mockedAsset = mockedFakeAlgoNFTAsset();
    mockedAsset2 = mockedFakeAlgoNFTAsset();
    mockedStatsService = mock(StatsService);
    mockedAlgoNFTAssetService = mock(AlgoNFTAssetService);
    container.register(StatsService, { useValue: instance(mockedStatsService) });
    container.register(AlgoNFTAssetService, { useValue: instance(mockedAlgoNFTAssetService) });
  });
  afterEach(() => {
    container.clearInstances();
    container.reset();
  });
  describe('assetCurrentRank', () => {
    test('gets the assets current rank when you have no wins or losses', async () => {
      const returnedAssets = [mockedAsset];
      when(mockedStatsService.assetRankingByWinsTotalGames()).thenResolve(returnedAssets);
      const result = await dtUtils.assetCurrentRank(mockedAsset);
      expect(result).toEqual({ currentRank: '1', totalAssets: '1' });
    });
    test('gets the assets current rank when it has some wins and another asset does not', async () => {
      const returnedAssets = [mockedAsset, mockedAsset2];
      when(mockedStatsService.assetRankingByWinsTotalGames()).thenResolve(returnedAssets);
      // Generate a user with a wallet and asset
      const result = await dtUtils.assetCurrentRank(mockedAsset2);
      expect(result).toEqual({ currentRank: '2', totalAssets: '2' });
    });
  });
  describe('coolDownsDescending', () => {
    test('returns an empty array when no assets exist', async () => {
      when(
        mockedAlgoNFTAssetService.getAllAssetsByOwner(mockedGuildMember.id as DiscordId),
      ).thenResolve([]);
      const result = await dtUtils.coolDownsDescending(mockedGuildMember);
      expect(result).toEqual([]);
    });
    test('checks the results when one asset has a cooldown to include the 1 result', async () => {
      mockedAsset.dojoCoolDown = new Date('2024-01-01');
      when(
        mockedAlgoNFTAssetService.getAllAssetsByOwner(mockedGuildMember.id as DiscordId),
      ).thenResolve([mockedAsset]);

      const result = await dtUtils.coolDownsDescending(mockedGuildMember);
      expect(result).toHaveLength(1);
    });
    test('checks the results when 2 assets have a cooldown and they are in the correct order', async () => {
      when(
        mockedAlgoNFTAssetService.getAllAssetsByOwner(mockedGuildMember.id as DiscordId),
      ).thenResolve([mockedAsset, mockedAsset2]);
      mockedAsset.dojoCoolDown = new Date('2024-01-01');
      mockedAsset2.dojoCoolDown = new Date('2025-01-01');
      const result = await dtUtils.coolDownsDescending(mockedGuildMember);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockedAsset2);
      expect(result[1]).toEqual(mockedAsset);
    });
  });
  describe('factorChancePct', () => {
    test('returns a calculated factor', async () => {
      when(mockedStatsService.getBonusData(anything(), anything())).thenResolve({
        averageTotalGames: 1,
        assetTotalGames: 1,
        averageWins: 1,
        assetWins: 1,
        averageRank: 1,
        assetRank: 1,
        averageTotalAssets: 1,
        userTotalAssets: 1,
      });
      const expectedResults: dtUtils.IIncreaseDecrease = {
        increase: 0.1,
        decrease: 0.7,
      };
      const result = await dtUtils.factorChancePct(mockedAsset, mockedGuildMember.id as DiscordId);
      expect(result).toEqual(expectedResults);
    });
  });
});
