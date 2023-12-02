import { Client } from 'discordx';

import { instance, mock, verify, when } from 'ts-mockito';

import { mockedFakeStdAsset } from '../../tests/mocks/mock-functions.js';
import { getConfig } from '../config/config.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { Algorand } from './algorand.js';
import { GameAssets } from './game-assets.js';

describe('GameAssets', () => {
  let algoStdAssetServiceMock: AlgoStdAssetsService;
  let algorandServiceMock: Algorand;
  let gameAssets: GameAssets;
  const mockAsset = mockedFakeStdAsset();
  beforeEach(() => {
    algoStdAssetServiceMock = mock(AlgoStdAssetsService);
    algorandServiceMock = mock(Algorand);
    gameAssets = new GameAssets(instance(algoStdAssetServiceMock), instance(algorandServiceMock));
  });
  describe('Check if the game assets are available', () => {
    test('should return not ready and undefined', () => {
      expect(gameAssets.isReady()).toBe(false);
      expect(() => gameAssets.karmaAsset).toThrow('karmaAsset has not been initialized yet!');
      expect(() => gameAssets.enlightenmentAsset).toThrow(
        'enlightenmentAsset has not been initialized yet!',
      );
    });
    it('should initialize all assets', async () => {
      const expectedResult: [PromiseSettledResult<boolean>, PromiseSettledResult<boolean>] = [
        { status: 'fulfilled', value: true },
        { status: 'fulfilled', value: true },
      ];

      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenResolve(mockAsset);
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenResolve(mockAsset);

      const result = await gameAssets.initializeAll();

      expect(result).toEqual(expectedResult);

      expect(gameAssets.karmaAsset).toEqual(mockAsset);
      expect(gameAssets.enlightenmentAsset).toEqual(mockAsset);

      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).once();
    });
    it('should fail to initialize an asset', async () => {
      const expectedResult: [PromiseSettledResult<boolean>, PromiseSettledResult<boolean>] = [
        { status: 'fulfilled', value: false },
        { status: 'fulfilled', value: false },
      ];

      when(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).thenReject(new Error('error'));
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLT')).thenReject(new Error('error'));
      const result = await gameAssets.initializeAll();
      expect(() => gameAssets.karmaAsset).toThrow('karmaAsset has not been initialized yet!');

      expect(result).toEqual(expectedResult);
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KRMA')).once();
    });
    it('should be able to use a different unitName for the assets', async () => {
      const expectedResult: [PromiseSettledResult<boolean>, PromiseSettledResult<boolean>] = [
        { status: 'fulfilled', value: true },
        { status: 'fulfilled', value: true },
      ];

      const gameAssetsConfig = {
        karma: 'KARMA',
        enlightenment: 'ENLIGHTENMENT',
      };
      getConfig().set('gameAssets', gameAssetsConfig);
      when(algoStdAssetServiceMock.getStdAssetByUnitName('KARMA')).thenResolve(mockAsset);
      when(algoStdAssetServiceMock.getStdAssetByUnitName('ENLIGHTENMENT')).thenResolve(mockAsset);

      const result = await gameAssets.initializeAll();

      expect(result).toEqual(expectedResult);

      expect(gameAssets.karmaAsset).toEqual(mockAsset);
      expect(gameAssets.enlightenmentAsset).toEqual(mockAsset);

      verify(algoStdAssetServiceMock.getStdAssetByUnitName('KARMA')).once();
      verify(algoStdAssetServiceMock.getStdAssetByUnitName('ENLIGHTENMENT')).once();
    });
  });
  describe('Check the Asset checkAssetBalance', () => {
    const sendTokenLowMessageSpy = jest.spyOn(ChannelUtils, 'sendTokenLowMessageToDevelopers');
    it('should check the balance of the asset', async () => {
      const assetStatus = {
        optedIn: true,
        tokens: 100,
      };
      when(algorandServiceMock.getTokenOptInStatus('address', mockAsset._id)).thenResolve(
        assetStatus,
      );
      await gameAssets['checkAssetBalance'](instance(mock(Client)), mockAsset, 10, 'address');
      verify(algorandServiceMock.getTokenOptInStatus('address', mockAsset._id)).once();
      expect(sendTokenLowMessageSpy).not.toHaveBeenCalled();
    });
  });
});
