import { mongoFixture } from '../../../tests/fixtures/mongodb-fixture.js';
import { arc69Example } from '../../../tests/mocks/mock-algorand-functions.js';
import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';

import { algoNFTAssetModel } from './algo-nft-asset.js';
import { AlgoNFTAssetRepository } from './algo-nft-asset.repo.js';
import { AlgoNFTAsset } from './algo-nft-asset.schema.js';

describe('Algorand NFT Asset Repository', () => {
  mongoFixture(algoNFTAssetModel);
  let algoNFTAssetRepo: AlgoNFTAssetRepository;
  const algoNFTAsset = mockedFakeAlgoNFTAsset(1, true);
  beforeAll(() => {
    algoNFTAssetRepo = new AlgoNFTAssetRepository();
  });
  describe('Create Methods', () => {
    describe('createAsset', () => {
      it('should create an asset', async () => {
        await algoNFTAssetRepo.createAsset({ ...algoNFTAsset } as AlgoNFTAsset);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets).toMatchObject([algoNFTAsset]);
      });
    });
  });
  describe('Delete Methods', () => {
    describe('removeAssetsByCreator', () => {
      it('should remove an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const result = await algoNFTAssetRepo.removeAssetsByCreator(algoNFTAsset.creator);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets).toEqual([]);
        expect(result).toMatchObject({ deletedCount: 1 });
      });
    });
  });
  describe('Find Methods', () => {
    describe('getAssetById', () => {
      it('should return null if no asset is found', async () => {
        const asset = await algoNFTAssetRepo.getAssetById(algoNFTAsset._id);
        expect(asset).toBeNull();
      });
      it('should return an asset if found', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const asset = await algoNFTAssetRepo.getAssetById(algoNFTAsset._id);
        expect(asset).toMatchObject(algoNFTAsset);
      });
    });
    describe('getAssetsByWallets', () => {
      it('should return an empty array if no assets are found', async () => {
        const assets = await algoNFTAssetRepo.getAssetsByWallets([algoNFTAsset.wallet!]);
        expect(assets).toEqual([]);
      });
      it('should return an array of assets if found', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const assets = await algoNFTAssetRepo.getAssetsByWallets([algoNFTAsset.wallet!]);
        expect(assets).toMatchObject([algoNFTAsset]);
      });
    });
    describe('getAllAssets', () => {
      it('should return an empty array if no assets are found', async () => {
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets).toEqual([]);
      });
      it('should return an array of assets if found', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets).toMatchObject([algoNFTAsset]);
      });
    });
    describe('getAssetsWithoutArc69', () => {
      it('should return an empty array if no assets are found', async () => {
        const assets = await algoNFTAssetRepo.getAssetsWithoutArc69();
        expect(assets).toEqual([]);
      });
      it('should return an array of assets if found', async () => {
        const newAsset = { ...algoNFTAsset };
        delete newAsset.arc69;
        await algoNFTAssetModel.create(newAsset);
        const assets = await algoNFTAssetRepo.getAssetsWithoutArc69();
        expect(assets).toMatchObject([newAsset]);
      });
    });
    describe('updateAssetDojoStats', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.updateAssetDojoStats(
          algoNFTAsset._id,
          1000,
          1,
          0,
          1,
        );
        expect(updatedAsset!.dojoCoolDown).toBeInstanceOf(Date);
        expect(updatedAsset!.dojoWins).toBe(1);
        expect(updatedAsset!.dojoLosses).toBe(0);
        expect(updatedAsset!.dojoZen).toBe(1);
      });
      it('should return null if no asset is found', async () => {
        const updatedAsset = await algoNFTAssetRepo.updateAssetDojoStats(
          algoNFTAsset._id,
          1000,
          1,
          0,
          1,
        );
        expect(updatedAsset).toBeNull();
      });
      it('should not change the values of the wins if defaults are used', async () => {
        await algoNFTAssetModel.create({ ...algoNFTAsset, dojoWins: 1 });
        const updatedAsset = await algoNFTAssetRepo.updateAssetDojoStats(algoNFTAsset._id, 1000);
        expect(updatedAsset).toMatchObject({ dojoWins: 1 });
      });
    });
    describe('setDojoStatsForManyAssets', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const update = {
          [algoNFTAsset._id.toString()]: { wins: 1, losses: 0, zen: 1 },
        };
        const updatedAsset = await algoNFTAssetRepo.setDojoStatsForManyAssets(update);
        const asset = await algoNFTAssetRepo.getAssetById(algoNFTAsset._id);
        expect(updatedAsset).toMatchObject({ modifiedCount: 1 });
        expect(asset).toMatchObject({ dojoWins: 1, dojoLosses: 0, dojoZen: 1 });
      });
      it('should return null if no asset is found', async () => {
        const updatedAsset = await algoNFTAssetRepo.setDojoStatsForManyAssets({
          [algoNFTAsset._id]: { wins: 1, losses: 0, zen: 1 },
        });
        expect(updatedAsset).toMatchObject({ modifiedCount: 0 });
      });
    });
  });
  describe('Update Methods', () => {
    describe('updateOneAsset', () => {
      test('should update the alias on one asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.updateOneAsset(algoNFTAsset._id, {
          alias: 'new alias',
        });
        expect(updatedAsset!.alias).toBe('new alias');
      });
      test('should not update an asset if the update has not changed', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.updateOneAsset(algoNFTAsset._id, {});
        expect(updatedAsset).toMatchObject(algoNFTAsset);
      });
      test('should return null because the asset does not exist', async () => {
        const updatedAsset = await algoNFTAssetRepo.updateOneAsset(algoNFTAsset._id, {
          alias: 'nope',
          battleCry: 'nope',
        });
        expect(updatedAsset).toBeNull();
      });
    });
    describe('addOrUpdateManyAssets', () => {
      it('should create an asset if it does not exist', async () => {
        const expectedResult = { ...algoNFTAsset };
        const result = await algoNFTAssetRepo.addOrUpdateManyAssets([algoNFTAsset]);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets[0]!.toJSON()).toMatchObject(expectedResult);
        expect(result).toMatchObject({ upsertedCount: 1 });
      });
      it('should update an asset if it exists', async () => {
        const result = await algoNFTAssetRepo.addOrUpdateManyAssets([algoNFTAsset]);
        const updatedAsset = { ...algoNFTAsset, name: 'Updated Name' };
        const result2 = await algoNFTAssetRepo.addOrUpdateManyAssets([updatedAsset]);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets[0]!.name).toBe('Updated Name');
        expect(result).toMatchObject({ upsertedCount: 1 });
        expect(result2).toMatchObject({ modifiedCount: 1 });
      });
      it('should match an asset if its a mongoose document', async () => {
        const asset = await algoNFTAssetModel.create({ ...algoNFTAsset });
        const result = await algoNFTAssetRepo.addOrUpdateManyAssets([asset]);
        const assets = await algoNFTAssetRepo.getAllAssets();
        expect(assets[0]!._id).toBe(asset._id);
        expect(result).toMatchObject({ matchedCount: 1 });
      });
    });
    describe('updateArc69ForMultipleAssets', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const arc69example2 = { ...arc69Example, description: 'new description' };
        const updatedAsset = await algoNFTAssetRepo.updateArc69ForMultipleAssets([
          { id: algoNFTAsset._id, arc69: arc69example2 },
        ]);
        expect(updatedAsset).toMatchObject({ modifiedCount: 1 });
      });
    });
    describe('clearAllAssetsCoolDowns', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.clearAllAssetsCoolDowns();
        expect(updatedAsset).toMatchObject({ modifiedCount: 1 });
      });
      it('should return null if no asset is found', async () => {
        const updatedAsset = await algoNFTAssetRepo.clearAllAssetsCoolDowns();
        expect(updatedAsset).toMatchObject({ modifiedCount: 0 });
      });
    });
    describe('clearAssetsCoolDownsByWallets', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.clearAssetsCoolDownsByWallets([
          algoNFTAsset.wallet!,
        ]);
        expect(updatedAsset).toMatchObject({ modifiedCount: 1 });
      });
      it('should return null if no asset is found', async () => {
        const updatedAsset = await algoNFTAssetRepo.clearAssetsCoolDownsByWallets([
          algoNFTAsset.wallet!,
        ]);
        expect(updatedAsset).toMatchObject({ modifiedCount: 0 });
      });
    });
    describe('clearAssetsCoolDownsByIds', () => {
      it('should update an asset', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const updatedAsset = await algoNFTAssetRepo.clearAssetsCoolDownsByIds([algoNFTAsset._id]);
        expect(updatedAsset).toMatchObject({ modifiedCount: 1 });
      });
      it('should return null if no asset is found', async () => {
        const updatedAsset = await algoNFTAssetRepo.clearAssetsCoolDownsByIds([algoNFTAsset._id]);
        expect(updatedAsset).toMatchObject({ modifiedCount: 0 });
      });
    });
  });
  describe('Count Methods', () => {
    describe('getAssetCountByWallets', () => {
      it('should return 0 if no assets are found', async () => {
        const count = await algoNFTAssetRepo.getAssetCountByWallets([algoNFTAsset.wallet!]);
        expect(count).toBe(0);
      });
      it('should return the number of assets found', async () => {
        await algoNFTAssetModel.create(algoNFTAsset);
        const count = await algoNFTAssetRepo.getAssetCountByWallets([algoNFTAsset.wallet!]);
        expect(count).toBe(1);
      });
    });
  });
  describe('Aggregate Methods', () => {
    describe('getRandomAssetsSampleByWallets', () => {
      it('should return an empty array if no assets are found', async () => {
        const assets = await algoNFTAssetRepo.getRandomAssetsSampleByWallets(
          [algoNFTAsset.wallet!],
          5,
        );
        expect(assets).toEqual([]);
      });
      it('should return an array of assets if found', async () => {
        const expectedAsset = structuredClone(algoNFTAsset);
        expectedAsset.dojoCoolDown = new Date(expectedAsset.dojoCoolDown);
        // delete expectedAsset.$setOnInsert; // Remove the $setOnInsert property
        await algoNFTAssetModel.create(algoNFTAsset);
        const assets = await algoNFTAssetRepo.getRandomAssetsSampleByWallets(
          [algoNFTAsset.wallet!],
          5,
        );
        expect(assets).toMatchObject([expectedAsset]);
      });
    });
  });
});
