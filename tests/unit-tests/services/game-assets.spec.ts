import { instance, mock, verify, when } from 'ts-mockito';

import { AlgoStdAsset } from '../../../src/database/algo-std-asset/algo-std-asset.schema.js';
import { AlgoStdAssetsService } from '../../../src/services/algo-std-assets.js';
import { GameAssets } from '../../../src/services/game-assets.js';

describe('GameAssets', () => {
  let algoStdAssetServiceMock: AlgoStdAssetsService;
  let gameAssets: GameAssets;
  const mockAsset = {
    unitName: 'KRMA',
    _id: 123,
    name: 'name',
    url: 'url',
    decimals: 123,
  } as AlgoStdAsset;
  beforeEach(() => {
    algoStdAssetServiceMock = mock(AlgoStdAssetsService);
    gameAssets = new GameAssets(instance(algoStdAssetServiceMock));
  });
  describe('Check if the game assets are available', () => {
    test('should return not ready and undefined', () => {
      expect(gameAssets.isReady()).toBe(false);
      expect(gameAssets.karmaAsset).toBeUndefined();
      expect(gameAssets.enlightenmentAsset).toBeUndefined();
    });
    it('should initialize KRMA asset', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenResolve(mockAsset);

      const result = await gameAssets.initializeKRMA();

      expect(result).toBe(true);
      expect(gameAssets.karmaAsset).toBe(mockAsset);
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
    });

    it('should initialize ENLT asset', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenResolve(mockAsset);

      const result = await gameAssets.initializeENLT();

      expect(result).toBe(true);
      expect(gameAssets.enlightenmentAsset).toBe(mockAsset);
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).once();
    });
    it('should fail to initialize KRMA asset', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenReject(new Error('error'));

      const result = await gameAssets.initializeKRMA();

      expect(result).toBe(false);
      expect(gameAssets.karmaAsset).toBeUndefined();
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
    });
    it('should initialize all assets', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenResolve(mockAsset);
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenResolve(mockAsset);

      const result = await gameAssets.initializeAll();

      expect(result).toEqual([true, true]);
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).once();
    });
  });
});
