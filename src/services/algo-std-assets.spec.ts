import { anything, instance, mock, verify, when } from 'ts-mockito';

import { mockedFakeStdAsset } from '../../tests/mocks/mock-functions.js';
import { AlgoStdAssetsRepository } from '../database/algo-std-asset/algo-std-asset.repo.js';
import { LookUpAssetByIDResponse } from '../types/algorand.js';

import { stdAssetTemplate } from './algo-std-assets.formatter.js';
import { AlgoStdAssetsService } from './algo-std-assets.js';
import { Algorand } from './algorand.js';

describe('AlgoStdAssetsService', () => {
  let service: AlgoStdAssetsService;
  let mockAlgorandRepo: Algorand;
  let mockAlgoStdAssetRepo: AlgoStdAssetsRepository;
  const mockAlgoStdAsset = mockedFakeStdAsset();
  let mockAlgoReturnStdAsset: LookUpAssetByIDResponse;
  beforeEach(() => {
    mockAlgoReturnStdAsset = {
      asset: {
        index: mockAlgoStdAsset._id,
        params: {
          name: mockAlgoStdAsset.name,
          'unit-name': mockAlgoStdAsset.unitName,
          url: mockAlgoStdAsset.url,
          decimals: mockAlgoStdAsset.decimals,
        },
      },
    } as LookUpAssetByIDResponse;
    mockAlgorandRepo = mock(Algorand);
    mockAlgoStdAssetRepo = mock(AlgoStdAssetsRepository);
    service = new AlgoStdAssetsService(instance(mockAlgorandRepo), instance(mockAlgoStdAssetRepo));
  });
  describe('setDecimalsForAlgoStdAsset', () => {
    it('should return 0 when decimals is 0', () => {
      const stdAsset = mockAlgoReturnStdAsset;
      stdAsset.asset.params.decimals = 0;

      const result = service.setDecimalsForAlgoStdAsset(stdAsset);

      expect(result).toBe(0);
    });
    it('should return decimals when decimals is between 0 and 19', () => {
      const stdAsset = mockAlgoReturnStdAsset;
      stdAsset.asset.params.decimals = 1;

      const result = service.setDecimalsForAlgoStdAsset(stdAsset);

      expect(result).toBe(1);
    });
    it('should throw an error when decimals is greater than 19', () => {
      const stdAsset = mockAlgoReturnStdAsset;
      stdAsset.asset.params.decimals = 20;

      expect(() => service.setDecimalsForAlgoStdAsset(stdAsset)).toThrow(
        'Invalid decimals value for asset must be between 0 and 19',
      );
    });
  });
  describe('createAlgoStdAssetFromLookupResult', () => {
    it('should create a new Algo standard asset', async () => {
      when(mockAlgoStdAssetRepo.createStdAsset(anything())).thenResolve(mockAlgoStdAsset);

      const result = await service.createAlgoStdAssetFromLookupResult(mockAlgoReturnStdAsset);

      expect(result).toEqual(mockAlgoStdAsset);
      verify(mockAlgoStdAssetRepo.createStdAsset(anything())).once();
    });
    it('should create a new algo std asset when params are null', async () => {
      const stdAsset = mockAlgoReturnStdAsset;
      delete stdAsset.asset.params.name;
      delete stdAsset.asset.params['unit-name'];
      delete stdAsset.asset.params.url;
      when(mockAlgoStdAssetRepo.createStdAsset(anything())).thenResolve(mockAlgoStdAsset);

      const result = await service.createAlgoStdAssetFromLookupResult(stdAsset);

      expect(result).toEqual(mockAlgoStdAsset);
      verify(mockAlgoStdAssetRepo.createStdAsset(anything())).once();
    });
  });
  describe('addAlgoStdAsset', () => {
    it('should add a new Algo standard asset', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).thenResolve(false);
      when(mockAlgorandRepo.lookupAssetByIndex(assetIndex)).thenResolve(mockAlgoReturnStdAsset);
      when(mockAlgoStdAssetRepo.createStdAsset(anything())).thenResolve(mockAlgoStdAsset);

      await service.addAlgoStdAsset(assetIndex);

      verify(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).once();
      verify(mockAlgorandRepo.lookupAssetByIndex(assetIndex)).once();
      verify(mockAlgoStdAssetRepo.createStdAsset(anything())).once();
    });
    it('should throw an error if the asset already exists', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).thenResolve(true);

      await expect(service.addAlgoStdAsset(assetIndex)).rejects.toThrow(
        stdAssetTemplate.AssetIndexExists({ assetIndex }),
      );

      verify(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).once();
    });
    it('should throw an error if the asset has the same unit name as another asset', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).thenResolve(false);
      when(mockAlgorandRepo.lookupAssetByIndex(assetIndex)).thenResolve(mockAlgoReturnStdAsset);
      when(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).thenResolve(
        mockAlgoStdAsset,
      );

      await expect(service.addAlgoStdAsset(assetIndex)).rejects.toThrow(
        stdAssetTemplate.AssetUnitNameExists({ unitName: mockAlgoStdAsset.unitName }),
      );

      verify(mockAlgoStdAssetRepo.doesAssetExist(assetIndex)).once();
      verify(mockAlgorandRepo.lookupAssetByIndex(assetIndex)).once();
      verify(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).once();
    });
  });
  describe('checkForAssetWithSameUnitName', () => {
    it('should return void because the asset doesnt have a unit name', async () => {
      const stdAsset = mockAlgoReturnStdAsset;
      delete stdAsset.asset.params['unit-name'];

      await service.checkForAssetWithSameUnitName(stdAsset);

      verify(
        mockAlgoStdAssetRepo.getStdAssetByUnitName(stdAsset.asset.params['unit-name']!),
      ).never();
    });
    it('should not throw an error because unit name doesnt exist', async () => {
      const stdAsset = mockAlgoReturnStdAsset;
      when(
        mockAlgoStdAssetRepo.getStdAssetByUnitName(stdAsset.asset.params['unit-name']!),
      ).thenResolve(null);

      await service.checkForAssetWithSameUnitName(stdAsset);

      verify(
        mockAlgoStdAssetRepo.getStdAssetByUnitName(stdAsset.asset.params['unit-name']!),
      ).once();
    });
    it('should throw an error because unit name exists', async () => {
      const stdAsset = mockAlgoReturnStdAsset;
      when(
        mockAlgoStdAssetRepo.getStdAssetByUnitName(stdAsset.asset.params['unit-name']!),
      ).thenResolve(mockAlgoStdAsset);

      await expect(service.checkForAssetWithSameUnitName(stdAsset)).rejects.toThrow(
        stdAssetTemplate.AssetUnitNameExists({ unitName: stdAsset.asset.params['unit-name']! }),
      );

      verify(
        mockAlgoStdAssetRepo.getStdAssetByUnitName(stdAsset.asset.params['unit-name']!),
      ).once();
    });
  });
  describe('deleteStdAsset', () => {
    it('should delete an Algo standard asset', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.deleteStdAsset(assetIndex)).thenResolve(true);

      await service.deleteStdAsset(assetIndex);

      verify(mockAlgoStdAssetRepo.deleteStdAsset(assetIndex)).once();
    });
    it('should throw an error if the asset doesnt exist', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.deleteStdAsset(assetIndex)).thenResolve(false);

      await expect(service.deleteStdAsset(assetIndex)).rejects.toThrow(
        stdAssetTemplate.AssetIndexNotFound({ assetIndex }),
      );

      verify(mockAlgoStdAssetRepo.deleteStdAsset(assetIndex)).once();
    });
  });
  describe('getAllStdAssets', () => {
    it('should get all Algo standard assets', async () => {
      when(mockAlgoStdAssetRepo.getAllStdAssets()).thenResolve([mockAlgoStdAsset]);

      const result = await service.getAllStdAssets();

      expect(result).toEqual([mockAlgoStdAsset]);
      verify(mockAlgoStdAssetRepo.getAllStdAssets()).once();
    });
  });
  describe('getStdAssetByAssetIndex', () => {
    it('should get an Algo standard asset by asset index', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.getStdAssetByAssetIndex(assetIndex)).thenResolve(mockAlgoStdAsset);

      const result = await service.getStdAssetByAssetIndex(assetIndex);

      expect(result).toEqual(mockAlgoStdAsset);
      verify(mockAlgoStdAssetRepo.getStdAssetByAssetIndex(assetIndex)).once();
    });
    it('should throw an error if the asset doesnt exist', async () => {
      const assetIndex = 1;
      when(mockAlgoStdAssetRepo.getStdAssetByAssetIndex(assetIndex)).thenResolve(null);

      await expect(service.getStdAssetByAssetIndex(assetIndex)).rejects.toThrow(
        stdAssetTemplate.AssetIndexNotFound({ assetIndex }),
      );

      verify(mockAlgoStdAssetRepo.getStdAssetByAssetIndex(assetIndex)).once();
    });
  });
  describe('getStdAssetByUnitName', () => {
    it('should get an Algo standard asset by unit name', async () => {
      when(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).thenResolve(
        mockAlgoStdAsset,
      );

      const result = await service.getStdAssetByUnitName(mockAlgoStdAsset.unitName);

      expect(result).toEqual(mockAlgoStdAsset);
      verify(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).once();
    });
    it('should throw an error if the asset doesnt exist', async () => {
      when(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).thenResolve(null);

      await expect(service.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).rejects.toThrow(
        stdAssetTemplate.AssetUnitNameNotFound({ unitName: mockAlgoStdAsset.unitName }),
      );

      verify(mockAlgoStdAssetRepo.getStdAssetByUnitName(mockAlgoStdAsset.unitName)).once();
    });
  });
});
