import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';
import { setupMongo, tearDownMongo } from '../../../tests/setup/mongodb.setup.js';

import { algoNFTAssetModel } from './algo-nft-asset.js';
import { AlgoNFTAssetRepository } from './algo-nft-asset.repo.js';
import { AlgoNFTAsset } from './algo-nft-asset.schema.js';

describe('Algorand NFT Asset Repository', () => {
  let algoNFTAssetRepo: AlgoNFTAssetRepository;
  const algoNFTAsset = mockedFakeAlgoNFTAsset(1, true);
  beforeAll(async () => {
    await setupMongo();
    algoNFTAssetRepo = new AlgoNFTAssetRepository();
  });
  afterEach(async () => {
    await algoNFTAssetModel.deleteMany({});
  });
  afterAll(async () => {
    await tearDownMongo(algoNFTAssetModel);
  });
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
  describe('createAsset', () => {
    it('should create an asset', async () => {
      await algoNFTAssetRepo.createAsset({ ...algoNFTAsset } as AlgoNFTAsset);
      const assets = await algoNFTAssetRepo.getAllAssets();
      expect(assets).toMatchObject([algoNFTAsset]);
    });
  });
  describe('addOrUpdateManyAssets', () => {
    it('should create an asset if it does not exist', async () => {
      const expectedResult = { ...algoNFTAsset };
      await algoNFTAssetRepo.addOrUpdateManyAssets([algoNFTAsset]);
      const assets = await algoNFTAssetRepo.getAllAssets();
      expect(assets[0]!.toJSON()).toMatchObject(expectedResult);
    });
    it('should update an asset if it exists', async () => {
      await algoNFTAssetRepo.addOrUpdateManyAssets([algoNFTAsset]);
      const updatedAsset = { ...algoNFTAsset, name: 'Updated Name' };
      await algoNFTAssetRepo.addOrUpdateManyAssets([updatedAsset]);
      const assets = await algoNFTAssetRepo.getAllAssets();
      expect(assets[0]!.name).toBe('Updated Name');
    });
    it('should create an asset if its a mongoose document', async () => {
      const asset = await algoNFTAssetModel.create({ ...algoNFTAsset });
      await algoNFTAssetRepo.addOrUpdateManyAssets([asset]);
      const assets = await algoNFTAssetRepo.getAllAssets();
      expect(assets[0]!._id).toBe(asset._id);
    });
  });
});
