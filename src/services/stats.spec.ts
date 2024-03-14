import { anything, instance, mock, verify, when } from 'ts-mockito';

import { mockedFakeAlgoNFTAsset, mockedFakeUser } from '../../tests/mocks/mock-functions.js';
import { AlgoNFTAssetRepository } from '../database/algo-nft-asset/algo-nft-asset.repo.js';
import { DiscordId, WalletAddress } from '../types/core.js';

import { CustomCache } from './custom-cache.js';
import { StatsService } from './stats.js';
import { UserService } from './user.js';

describe('StatsService', () => {
  let statsService: StatsService;
  let algoNFTRepo: AlgoNFTAssetRepository;
  let userService: UserService;
  let cache: CustomCache;
  const discordUserId = 'testDiscordUserId' as DiscordId;
  const discordUserId2 = 'testDiscordUserId2' as DiscordId;
  const walletAddress = 'testWallet1' as WalletAddress;
  const walletAddress2 = 'testWallet2' as WalletAddress;
  const fakeUser = mockedFakeUser(discordUserId);
  const fakeUser2 = mockedFakeUser(discordUserId2);

  beforeEach(() => {
    algoNFTRepo = mock(AlgoNFTAssetRepository);
    userService = mock(UserService);
    cache = mock(CustomCache);

    statsService = new StatsService(instance(algoNFTRepo), instance(userService), instance(cache));
    when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
      (_key, fetcher, _ttl) => fetcher(),
    );
  });
  describe('topNFTHolders', () => {
    it('should return an empty map', async () => {
      when(userService.getAllUsers()).thenResolve([]);
      when(userService.getUserWallets(anything())).thenResolve([]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

      const result = await statsService.topNFTHolders();

      expect(result).toEqual(new Map());
    });
    it('should return a map with one entry', async () => {
      const expectedUsers = [fakeUser];
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

      const result = await statsService.topNFTHolders();

      expect(result).toEqual(new Map([[fakeUser._id, 1]]));
    });
    it('should return a map with two entries', async () => {
      const expectedUsers = [fakeUser, fakeUser2];
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(userService.getUserWallets(discordUserId2)).thenResolve([walletAddress2]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

      const result = await statsService.topNFTHolders();

      expect(result).toEqual(
        new Map([
          [fakeUser._id, 1],
          [fakeUser2._id, 1],
        ]),
      );
    });
  });
  describe('getAssetsFromCacheOrRepo', () => {
    it('should call getFromCacheOrFetch when getAllAssetsCached is called', async () => {
      const fakeAssets = [mockedFakeAlgoNFTAsset()];
      when(algoNFTRepo.getAllAssets()).thenResolve(fakeAssets);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );

      const result = await statsService.getAllAssetsCached();

      verify(cache.getFromCacheOrFetch(anything(), anything(), anything())).once();
      expect(result).toEqual(fakeAssets);
    });
  });
  describe('assetRankingByWinsTotalGames', () => {
    it('should return an array with one entry', async () => {
      const mockAsset = mockedFakeAlgoNFTAsset();
      mockAsset.dojoWins = 1;
      when(algoNFTRepo.getAllAssets()).thenResolve([mockAsset]);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );

      const result = await statsService.assetRankingByWinsTotalGames();

      expect(result).toEqual([mockAsset]);
    });
    it('should return an array with two entries', async () => {
      const mockAsset = mockedFakeAlgoNFTAsset();
      mockAsset.dojoWins = 1;
      const mockAsset2 = mockedFakeAlgoNFTAsset();
      mockAsset2.dojoWins = 2;
      when(algoNFTRepo.getAllAssets()).thenResolve([mockAsset, mockAsset2]);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );

      const result = await statsService.assetRankingByWinsTotalGames();

      expect(result).toEqual([mockAsset2, mockAsset]);
    });
    it('should return an array with three entries, sorted by wins', async () => {
      const mockAsset = mockedFakeAlgoNFTAsset();
      mockAsset.dojoWins = 2;
      const mockAsset2 = mockedFakeAlgoNFTAsset();
      mockAsset2.dojoLosses = 1;
      const mockAsset3 = mockedFakeAlgoNFTAsset();
      mockAsset3.dojoWins = 2;
      when(algoNFTRepo.getAllAssets()).thenResolve([mockAsset, mockAsset2, mockAsset3]);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );
      const result = await statsService.assetRankingByWinsTotalGames();

      expect(result).toEqual([mockAsset, mockAsset3, mockAsset2]);
    });
  });
  describe('getBonusData', () => {
    it('should return a GameBonusData object when you have a one user and one asset', async () => {
      const mockAsset = mockedFakeAlgoNFTAsset();
      mockAsset.dojoWins = 1;
      const expectedAverageData = {
        averageTotalGames: 1,
        averageWins: 1,
      };
      const expectedUsers = [fakeUser];

      when(algoNFTRepo.getAllAssets()).thenResolve([mockAsset]);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

      const result = await statsService.getBonusData(mockAsset, 1);

      expect(result).toEqual({
        averageTotalGames: expectedAverageData.averageTotalGames,
        assetTotalGames: 1,
        averageWins: expectedAverageData.averageWins,
        assetWins: 1,
        averageRank: 1,
        assetRank: 1,
        averageTotalAssets: 1,
        userTotalAssets: 1,
      });
    });
    it('should return a GameBonusData object when you have a one user and zero assets', async () => {
      const mockAsset = mockedFakeAlgoNFTAsset();
      mockAsset.dojoWins = 0;
      const expectedAverageData = {
        averageTotalGames: 0,
        averageWins: 0,
      };
      const expectedUsers = [fakeUser];

      when(algoNFTRepo.getAllAssets()).thenResolve([mockAsset]);
      when(cache.getFromCacheOrFetch(anything(), anything(), anything())).thenCall(
        (_key, fetcher, _ttl) => fetcher(),
      );
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

      const result = await statsService.getBonusData(mockAsset, 0);

      expect(result).toEqual({
        averageTotalGames: expectedAverageData.averageTotalGames,
        assetTotalGames: 0,
        averageWins: expectedAverageData.averageWins,
        assetWins: 0,
        averageRank: 1,
        assetRank: 0,
        averageTotalAssets: 0,
        userTotalAssets: 0,
      });
    });
  });
  describe('getTotalAssetsByUser', () => {
    describe('when we specify wallets for a user', () => {
      it('should return 0', async () => {
        when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

        const result = await statsService.getTotalAssetsByUser(discordUserId, [walletAddress]);

        expect(result).toBe(0);
      });
      it('should return 1', async () => {
        when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

        const result = await statsService.getTotalAssetsByUser(discordUserId, [walletAddress]);

        expect(result).toBe(1);
      });
    });
    describe('when we do not specify wallets for a user', () => {
      it('should return 0', async () => {
        when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

        const result = await statsService.getTotalAssetsByUser(discordUserId);

        expect(result).toBe(0);
      });
    });
  });
  describe('getTotalAssetsByWallet', () => {
    it('should return 0', async () => {
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

      const result = await statsService.getTotalAssetsByWallet(walletAddress);

      expect(result).toBe(0);
    });
    it('should return 1', async () => {
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

      const result = await statsService.getTotalAssetsByWallet(walletAddress);

      expect(result).toBe(1);
    });
  });
  describe('getAverageDarumaOwned', () => {
    it('should return 1', async () => {
      const expectedUsers = [fakeUser, fakeUser2];
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(userService.getUserWallets(discordUserId2)).thenResolve([walletAddress2]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(1);

      const result = await statsService.getAverageDarumaOwned();

      expect(result).toBe(1);
    });
    it('should return 0', async () => {
      const expectedUsers = [fakeUser, fakeUser2];
      when(userService.getAllUsers()).thenResolve(expectedUsers);
      when(userService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
      when(userService.getUserWallets(discordUserId2)).thenResolve([walletAddress2]);
      when(algoNFTRepo.getAssetCountByWallets(anything())).thenResolve(0);

      const result = await statsService.getAverageDarumaOwned();

      expect(result).toBe(0);
    });
  });
});
