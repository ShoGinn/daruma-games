import { instance, mock, when } from 'ts-mockito';
import { container } from 'tsyringe';

import { mockCustomCache } from '../../../tests/mocks/mock-custom-cache.js';
import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import * as CustomCache from '../../services/custom-cache.js';
import { StatsService } from '../../services/stats.js';
import { DiscordId } from '../../types/core.js';

import * as dtUtils from './dt-utils.js';

describe('asset tests that require db', () => {
  jest.spyOn(CustomCache, 'CustomCache').mockImplementation(() => mockCustomCache);
  let mockedAsset: AlgoNFTAsset;
  let mockedAsset2: AlgoNFTAsset;
  let mockedStatsService: StatsService;
  let mockedAlgoNFTAssetService: AlgoNFTAssetService;
  const discordUserId = '123456789' as DiscordId;

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
    const oneYearInFuture = new Date();
    oneYearInFuture.setFullYear(oneYearInFuture.getFullYear() + 1);
    const twoYearsInFuture = new Date();
    twoYearsInFuture.setFullYear(twoYearsInFuture.getFullYear() + 2);
    test('returns an empty array when no assets exist', async () => {
      when(mockedAlgoNFTAssetService.getAllAssetsByOwner(discordUserId)).thenResolve([]);
      const result = await dtUtils.coolDownsDescending(discordUserId);
      expect(result).toEqual([]);
    });
    test('checks the results when one asset has a cooldown to include the 1 result', async () => {
      mockedAsset.dojoCoolDown = oneYearInFuture;
      when(mockedAlgoNFTAssetService.getAllAssetsByOwner(discordUserId)).thenResolve([mockedAsset]);

      const result = await dtUtils.coolDownsDescending(discordUserId);
      expect(result).toHaveLength(1);
    });
    test('checks the results when 2 assets have a cooldown and they are in the correct order', async () => {
      when(mockedAlgoNFTAssetService.getAllAssetsByOwner(discordUserId)).thenResolve([
        mockedAsset,
        mockedAsset2,
      ]);
      mockedAsset.dojoCoolDown = oneYearInFuture;
      mockedAsset2.dojoCoolDown = twoYearsInFuture;
      const result = await dtUtils.coolDownsDescending(discordUserId);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockedAsset2);
      expect(result[1]).toEqual(mockedAsset);
    });
  });
});
