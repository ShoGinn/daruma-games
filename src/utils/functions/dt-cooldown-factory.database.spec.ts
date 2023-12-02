import { GuildMember } from 'discord.js';

import { anything, instance, mock, when } from 'ts-mockito';
import { container } from 'tsyringe';

import { mockCustomCache } from '../../../tests/mocks/mock-custom-cache.js';
import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import * as CustomCache from '../../services/custom-cache.js';
import { StatsService } from '../../services/stats.js';
import { DiscordId } from '../../types/core.js';

import { IIncreaseDecrease } from './dt-cooldown-factory.constants.js';
import { factorChancePct } from './dt-cooldown-factory.js';

describe('asset tests that require db', () => {
  jest.spyOn(CustomCache, 'CustomCache').mockImplementation(() => mockCustomCache);
  let mockedAsset: AlgoNFTAsset;
  let mockedStatsService: StatsService;
  let mockedAlgoNFTAssetService: AlgoNFTAssetService;
  const mockedGuildMember = {
    id: '123456789',
  } as GuildMember;

  beforeEach(() => {
    mockedAsset = mockedFakeAlgoNFTAsset();
    mockedStatsService = mock(StatsService);
    mockedAlgoNFTAssetService = mock(AlgoNFTAssetService);
    container.register(StatsService, { useValue: instance(mockedStatsService) });
    container.register(AlgoNFTAssetService, { useValue: instance(mockedAlgoNFTAssetService) });
  });
  afterEach(() => {
    container.clearInstances();
    container.reset();
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
      const expectedResults: IIncreaseDecrease = {
        increase: 0.1,
        decrease: 0.7,
      };
      const result = await factorChancePct(mockedAsset, mockedGuildMember.id as DiscordId);
      expect(result).toEqual(expectedResults);
    });
  });
});
