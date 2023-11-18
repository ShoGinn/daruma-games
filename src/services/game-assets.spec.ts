import { instance, mock, verify, when } from 'ts-mockito';

import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { GameAssets } from './game-assets.js';

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
      expect(() => gameAssets.karmaAsset).toThrow('Karma asset has not been initialized yet!');
      expect(() => gameAssets.enlightenmentAsset).toThrow(
        'Enlightenment asset has not been initialized yet!',
      );
    });
    it('should initialize all assets', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenResolve(mockAsset);
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenResolve(mockAsset);

      const result = await gameAssets.initializeAll();

      expect(result).toEqual([true, true]);

      expect(gameAssets.karmaAsset).toEqual(mockAsset);
      expect(gameAssets.enlightenmentAsset).toEqual(mockAsset);

      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).once();
    });
    it('should fail to initialize an asset', async () => {
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenReject(new Error('error'));
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenReject(new Error('error'));
      const result = await gameAssets.initializeAll();
      expect(() => gameAssets.karmaAsset).toThrow('Karma asset has not been initialized yet!');

      expect(result).toEqual([false, false]);
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
    });
  });
});
