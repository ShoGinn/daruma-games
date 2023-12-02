import { mongoFixture } from '../../../tests/fixtures/mongodb-fixture.js';

import { algoStdAssetModel } from './algo-std-asset.js';
import { AlgoStdAssetsRepository } from './algo-std-asset.repo.js';
import { IAlgoStdAsset } from './algo-std-asset.schema.js';

describe('Algorand Standard Asset Repository', () => {
  mongoFixture(algoStdAssetModel);
  let algoStdAssetRepo: AlgoStdAssetsRepository;
  const algoAsset: IAlgoStdAsset = {
    _id: 1,
    unitName: 'test',
    name: 'test',
    url: 'test',
    decimals: 0,
  };
  beforeAll(() => {
    algoStdAssetRepo = new AlgoStdAssetsRepository();
  });
  describe('doesAssetExist', () => {
    it('should return true if asset exists', async () => {
      await algoStdAssetModel.create(algoAsset);
      const result = await algoStdAssetRepo.doesAssetExist(algoAsset._id);
      expect(result).toBe(true);
    });
    it('should return false if asset does not exist', async () => {
      const result = await algoStdAssetRepo.doesAssetExist(algoAsset._id);
      expect(result).toBe(false);
    });
  });
  describe('createStdAsset', () => {
    it('should create a new asset', async () => {
      const result = await algoStdAssetRepo.createStdAsset(algoAsset);
      const allAssets = await algoStdAssetModel.find().exec();
      expect(result).toMatchObject(algoAsset);
      expect(allAssets).toHaveLength(1);
    });
  });
  describe('deleteStdAsset', () => {
    it('should delete an asset', async () => {
      await algoStdAssetModel.create(algoAsset);
      const result = await algoStdAssetRepo.deleteStdAsset(algoAsset._id);
      const allAssets = await algoStdAssetModel.find().exec();
      expect(result).toBe(true);
      expect(allAssets).toHaveLength(0);
    });
    it('should return false if asset does not exist', async () => {
      const result = await algoStdAssetRepo.deleteStdAsset(algoAsset._id);
      expect(result).toBe(false);
    });
  });
  describe('getAllStdAssets', () => {
    it('should return all assets', async () => {
      await algoStdAssetModel.create(algoAsset);
      const result = await algoStdAssetRepo.getAllStdAssets();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(algoAsset);
    });
    it('should return an empty array if no assets exist', async () => {
      const result = await algoStdAssetRepo.getAllStdAssets();
      expect(result).toHaveLength(0);
    });
  });
  describe('getStdAssetByAssetIndex', () => {
    it('should return an asset by asset index', async () => {
      await algoStdAssetModel.create(algoAsset);
      const result = await algoStdAssetRepo.getStdAssetByAssetIndex(algoAsset._id);
      expect(result).toMatchObject(algoAsset);
    });
    it('should return null if asset does not exist', async () => {
      const result = await algoStdAssetRepo.getStdAssetByAssetIndex(algoAsset._id);
      expect(result).toBeNull();
    });
  });
  describe('getStdAssetByUnitName', () => {
    it('should return an asset by unit name', async () => {
      await algoStdAssetModel.create(algoAsset);
      const result = await algoStdAssetRepo.getStdAssetByUnitName(algoAsset.unitName);
      expect(result).toMatchObject(algoAsset);
    });
    it('should return null if asset does not exist', async () => {
      const result = await algoStdAssetRepo.getStdAssetByUnitName(algoAsset.unitName);
      expect(result).toBeNull();
    });
  });
});
