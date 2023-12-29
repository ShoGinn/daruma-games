import { anything, deepEqual, instance, mock, spy, verify, when } from 'ts-mockito';

import { arc69Example } from '../../tests/mocks/mock-algorand-functions.js';
import { mockedFakeAlgoNFTAsset } from '../../tests/mocks/mock-functions.js';
import { AlgoNFTAssetRepository } from '../database/algo-nft-asset/algo-nft-asset.repo.js';
import { AlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { DiscordId } from '../types/core.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { Algorand } from './algorand.js';
import { UserService } from './user.js';

describe('AlgoNFTAssetService', () => {
  let service: AlgoNFTAssetService;
  let mockAlgoNFTRepo: AlgoNFTAssetRepository;
  let mockAlgorand: Algorand;
  let mockUserService: UserService;
  let fakeNFTAsset: AlgoNFTAsset;
  const discordUserId = '123456789' as DiscordId;
  beforeEach(() => {
    fakeNFTAsset = mockedFakeAlgoNFTAsset();
    mockAlgoNFTRepo = mock(AlgoNFTAssetRepository);
    mockAlgorand = mock(Algorand);
    mockUserService = mock(UserService);
    service = new AlgoNFTAssetService(
      instance(mockAlgoNFTRepo),
      instance(mockAlgorand),
      instance(mockUserService),
    );
  });
  describe('getAssetById', () => {
    it('should get asset by id', async () => {
      when(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).thenResolve(fakeNFTAsset);

      const result = await service.getAssetById(fakeNFTAsset._id);

      expect(result).toEqual(fakeNFTAsset);
      verify(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).once();
    });
    it('should return null', async () => {
      when(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).thenResolve(null);

      const result = await service.getAssetById(fakeNFTAsset._id);

      expect(result).toBeNull();
      verify(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).once();
    });
  });
  describe('getAllAssets', () => {
    it('should get all assets', async () => {
      when(mockAlgoNFTRepo.getAllAssets()).thenResolve([fakeNFTAsset]);

      const result = await service.getAllAssets();

      expect(result).toEqual([fakeNFTAsset]);
      verify(mockAlgoNFTRepo.getAllAssets()).once();
    });
    it('should return empty array', async () => {
      when(mockAlgoNFTRepo.getAllAssets()).thenResolve([]);

      const result = await service.getAllAssets();

      expect(result).toEqual([]);
      verify(mockAlgoNFTRepo.getAllAssets()).once();
    });
  });
  describe('getAllAssetIndexesWithoutArc69', () => {
    it('should get one asset indexes without arc69', async () => {
      when(mockAlgoNFTRepo.getAssetsWithoutArc69()).thenResolve([fakeNFTAsset]);

      const result = await service.getAllAssetIndexesWithoutArc69();

      expect(result).toEqual([fakeNFTAsset._id]);
      verify(mockAlgoNFTRepo.getAssetsWithoutArc69()).once();
    });
    it('should return empty array', async () => {
      when(mockAlgoNFTRepo.getAssetsWithoutArc69()).thenResolve([]);

      const result = await service.getAllAssetIndexesWithoutArc69();

      expect(result).toEqual([]);
      verify(mockAlgoNFTRepo.getAssetsWithoutArc69()).once();
    });
  });
  describe('getAllAssetsByOwner', () => {
    it('should get all assets by owner', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getAssetsByWallets(anything())).thenResolve([fakeNFTAsset]);

      const result = await service.getAllAssetsByOwner(discordUserId);

      expect(result).toEqual([fakeNFTAsset]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getAssetsByWallets(anything())).once();
    });
    it('should return empty array', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getAssetsByWallets(anything())).thenResolve([]);

      const result = await service.getAllAssetsByOwner(discordUserId);

      expect(result).toEqual([]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getAssetsByWallets(anything())).once();
    });
  });
  describe('getOwnerWalletFromAssetIndex', () => {
    it('should get owner wallet from asset index', async () => {
      when(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).thenResolve(fakeNFTAsset);

      const result = await service.getOwnerWalletFromAssetIndex(fakeNFTAsset._id);

      expect(result).toEqual(fakeNFTAsset.wallet);
      verify(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).once();
    });
    it('should throw error', async () => {
      when(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).thenResolve(null);

      await expect(service.getOwnerWalletFromAssetIndex(fakeNFTAsset._id)).rejects.toThrow(
        'Owner wallet not found',
      );
      verify(mockAlgoNFTRepo.getAssetById(fakeNFTAsset._id)).once();
    });
  });
  describe('addNFTAsset', () => {
    it('should add NFT asset', async () => {
      when(mockAlgoNFTRepo.createAsset(anything())).thenResolve(fakeNFTAsset);

      const result = await service.addNFTAsset(fakeNFTAsset);

      expect(result).toEqual(fakeNFTAsset);
      verify(mockAlgoNFTRepo.createAsset(anything())).once();
    });
  });
  describe('addOrUpdateManyAssets', () => {
    it('should add or update many assets', async () => {
      const assets = [fakeNFTAsset];
      await service.addOrUpdateManyAssets(assets);

      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(assets)).once();
    });
  });
  describe('removeCreatorsAssets', () => {
    it('should remove creators assets', async () => {
      when(mockAlgoNFTRepo.removeAssetsByCreator(fakeNFTAsset.creator)).thenResolve({
        deletedCount: 1,
        acknowledged: true,
      });

      const result = await service.removeCreatorsAssets(fakeNFTAsset.creator);

      expect(result).toMatchObject({ deletedCount: 1 });
      verify(mockAlgoNFTRepo.removeAssetsByCreator(fakeNFTAsset.creator)).once();
    });
  });
  describe('updateAliasOrBattleCry', () => {
    it('should update alias or battle cry', async () => {
      const alias = 'alias';
      const battleCry = 'battleCry';
      when(mockAlgoNFTRepo.updateOneAsset(anything(), anything())).thenResolve(fakeNFTAsset);

      const result = await service.updateAliasOrBattleCry(fakeNFTAsset._id, alias, battleCry);

      expect(result).toEqual(fakeNFTAsset);
      verify(
        mockAlgoNFTRepo.updateOneAsset(
          fakeNFTAsset._id,
          deepEqual({
            alias,
            battleCry,
          }),
        ),
      ).once();
    });
    it('should return null because asset does not exist', async () => {
      const alias = 'alias';
      const battleCry = 'battleCry';
      when(
        mockAlgoNFTRepo.updateOneAsset(fakeNFTAsset._id, {
          alias,
          battleCry,
        }),
      ).thenResolve(null);

      const result = await service.updateAliasOrBattleCry(fakeNFTAsset._id, alias, battleCry);

      expect(result).toBeNull();
      verify(
        mockAlgoNFTRepo.updateOneAsset(
          fakeNFTAsset._id,
          deepEqual({
            alias,
            battleCry,
          }),
        ),
      ).once();
    });
    it('should return null because no updates were made', async () => {
      const result = await service.updateAliasOrBattleCry(fakeNFTAsset._id);

      expect(result).toBeNull();
      verify(mockAlgoNFTRepo.updateOneAsset(fakeNFTAsset._id, anything())).never();
    });
  });
  describe('assetEndGameUpdate', () => {
    it('should update asset end game', async () => {
      const cooldown = 100;
      const dojoTraining = {
        wins: 1,
        losses: 1,
        zen: 1,
      };
      when(
        mockAlgoNFTRepo.updateAssetDojoStats(
          fakeNFTAsset._id,
          cooldown,
          dojoTraining.wins,
          dojoTraining.losses,
          dojoTraining.zen,
        ),
      ).thenResolve(fakeNFTAsset);

      const result = await service.assetEndGameUpdate(fakeNFTAsset._id, cooldown, dojoTraining);

      expect(result).toEqual(fakeNFTAsset);
      verify(
        mockAlgoNFTRepo.updateAssetDojoStats(
          fakeNFTAsset._id,
          cooldown,
          dojoTraining.wins,
          dojoTraining.losses,
          dojoTraining.zen,
        ),
      ).once();
    });
    it('should return null', async () => {
      const cooldown = 100;
      const dojoTraining = {
        wins: 1,
        losses: 1,
        zen: 1,
      };
      when(
        mockAlgoNFTRepo.updateAssetDojoStats(
          fakeNFTAsset._id,
          cooldown,
          dojoTraining.wins,
          dojoTraining.losses,
          dojoTraining.zen,
        ),
      ).thenResolve(null);

      const result = await service.assetEndGameUpdate(fakeNFTAsset._id, cooldown, dojoTraining);

      expect(result).toBeNull();
      verify(
        mockAlgoNFTRepo.updateAssetDojoStats(
          fakeNFTAsset._id,
          cooldown,
          dojoTraining.wins,
          dojoTraining.losses,
          dojoTraining.zen,
        ),
      ).once();
    });
  });
  describe('zeroOutAssetCooldown', () => {
    it('should zero out asset cooldown', async () => {
      when(mockAlgoNFTRepo.updateAssetDojoStats(fakeNFTAsset._id, 0)).thenResolve(fakeNFTAsset);

      await service.zeroOutAssetCooldown(fakeNFTAsset._id);

      verify(mockAlgoNFTRepo.updateAssetDojoStats(fakeNFTAsset._id, 0)).once();
    });
  });
  describe('clearAssetCoolDownsForAllUsers', () => {
    it('should clear asset cooldowns for all users', async () => {
      await service.clearAssetCoolDownsForAllUsers();

      verify(mockAlgoNFTRepo.clearAllAssetsCoolDowns()).once();
    });
  });
  describe('clearAssetCoolDownsForUser', () => {
    it('should clear asset cooldowns for user', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);

      await service.clearAssetCoolDownsForUser(discordUserId);

      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(
        mockAlgoNFTRepo.clearAssetsCoolDownsByWallets(deepEqual([fakeNFTAsset.wallet!])),
      ).once();
    });
  });
  describe('getSampleOfAssetsByUser', () => {
    it('should get sample of assets by user', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).thenResolve([
        fakeNFTAsset,
      ]);

      const result = await service.getSampleOfAssetsByUser(discordUserId, 1);

      expect(result).toEqual([fakeNFTAsset]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).once();
    });
    it('should return empty array', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).thenResolve([]);

      const result = await service.getSampleOfAssetsByUser(discordUserId, 1);

      expect(result).toEqual([]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).once();
    });
  });
  describe('randomAssetCoolDownReset', () => {
    it('should random asset cooldown reset', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).thenResolve([
        fakeNFTAsset,
      ]);

      const result = await service.randomAssetCoolDownReset(discordUserId, 1);

      expect(result).toEqual([fakeNFTAsset]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).once();
      verify(mockAlgoNFTRepo.clearAssetsCoolDownsByIds(anything())).once();
    });
    it('should return empty array', async () => {
      when(mockUserService.getUserWallets(discordUserId)).thenResolve([fakeNFTAsset.wallet!]);
      when(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).thenResolve([]);

      const result = await service.randomAssetCoolDownReset(discordUserId, 1);

      expect(result).toEqual([]);
      verify(mockUserService.getUserWallets(discordUserId)).once();
      verify(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).once();
      verify(mockAlgoNFTRepo.clearAssetsCoolDownsByIds(anything())).once();
    });
  });
  describe('updateOwnerWalletsOnCreatorAssets', () => {
    it('should update owner wallets on creator assets', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).thenResolve({
        modifiedCount: 1,
        upsertedCount: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([
        {
          address: 'newAddress',
          amount: 1,
          'is-frozen': false,
        },
      ]);
      await service.updateOwnerWalletsOnCreatorAssets();
      fakeNFTAsset.wallet = 'newAddress';

      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(deepEqual([fakeNFTAsset]))).once();
    });
    it('should not update the owner wallet because amount is 0', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([
        {
          address: 'newAddress',
          amount: 0,
          'is-frozen': false,
        },
      ]);
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
    it('should not update the owner wallet because amount is > 1', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([
        {
          address: 'newAddress',
          amount: 2,
          'is-frozen': false,
        },
      ]);
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
    it('should not update the owner wallet because address is the same', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([
        {
          address: fakeNFTAsset.wallet!,
          amount: 1,
          'is-frozen': false,
        },
      ]);
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
    it('should pull two assets one that updates and one that doesnt because the wallet is the same', async () => {
      const spyGetAllAssets = spy(service);
      const fakeNFTAsset2 = mockedFakeAlgoNFTAsset();
      when(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).thenResolve({
        modifiedCount: 1,
        upsertedCount: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset, fakeNFTAsset2]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([
        {
          address: 'newAddress',
          amount: 1,
          'is-frozen': false,
        },
      ]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset2._id)).thenResolve([
        {
          address: fakeNFTAsset2.wallet!,
          amount: 1,
          'is-frozen': false,
        },
      ]);
      await service.updateOwnerWalletsOnCreatorAssets();
      fakeNFTAsset.wallet = 'newAddress';
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset2._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(deepEqual([fakeNFTAsset]))).once();
    });
    it('should not update the owner wallet because address is not found', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenResolve([]);
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
    it('should handle the update when the assets are an empty array', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([]);
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
    it('should log an error after lookupAssetBalances fails', async () => {
      const spyGetAllAssets = spy(service);
      when(spyGetAllAssets.getAllAssets()).thenResolve([fakeNFTAsset]);
      when(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).thenReject(new Error('error'));
      await service.updateOwnerWalletsOnCreatorAssets();
      verify(spyGetAllAssets.getAllAssets()).once();
      verify(mockAlgorand.lookupAssetBalances(fakeNFTAsset._id)).once();
      verify(mockAlgoNFTRepo.addOrUpdateManyAssets(anything())).never();
    });
  });
  describe('updateBulkArc69', () => {
    it('should update bulk arc69', async () => {
      const spyOnService = spy(service);
      when(spyOnService.getAllAssetIndexesWithoutArc69()).thenResolve([1]);
      when(mockAlgorand.getBulkAssetArc69Metadata(anything())).thenResolve([
        { id: 1, arc69: arc69Example },
      ]);
      when(mockAlgoNFTRepo.updateArc69ForMultipleAssets(anything())).thenResolve();

      await service.updateBulkArc69();

      verify(mockAlgorand.getBulkAssetArc69Metadata(anything())).once();
      verify(mockAlgoNFTRepo.updateArc69ForMultipleAssets(anything())).once();
    });
    it('should not update bulk arc69', async () => {
      const spyOnService = spy(service);
      when(spyOnService.getAllAssetIndexesWithoutArc69()).thenResolve([]);
      when(mockAlgorand.getBulkAssetArc69Metadata(anything())).thenResolve([]);
      when(mockAlgoNFTRepo.updateArc69ForMultipleAssets(anything())).thenResolve();

      await service.updateBulkArc69();

      verify(mockAlgorand.getBulkAssetArc69Metadata(anything())).once();
      verify(mockAlgoNFTRepo.updateArc69ForMultipleAssets(anything())).once();
    });
  });
  describe('getRandomImageURLByWallet', () => {
    it('should get random image url by wallet', async () => {
      when(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).thenResolve([
        fakeNFTAsset,
      ]);

      const result = await service.getRandomImageURLByWallet(fakeNFTAsset.wallet!);

      expect(result).toEqual(fakeNFTAsset.url);
      verify(mockAlgoNFTRepo.getRandomAssetsSampleByWallets(anything(), anything())).once();
    });
  });
});
