/* eslint-disable @typescript-eslint/unbound-method */
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { container } from 'tsyringe';

import { mockAlgorand } from '../../../tests/mocks/mock-algorand-functions.js';
import { mockedFakePlayer } from '../../../tests/mocks/mock-functions.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import * as algorand from '../../services/algorand.js';
import { RewardsService } from '../../services/rewards.js';
import { GameWinInfo } from '../../types/daruma-training.js';
import * as dtUtils from '../functions/dt-utils.js';

import { Player } from './dt-player.js';

describe('The Player class', () => {
  let mockAlgoNFTAssetService: AlgoNFTAssetService;
  let mockRewardsService: RewardsService;
  let player: Player;
  jest.spyOn(dtUtils, 'rollForCoolDown').mockResolvedValue(0);
  jest
    .spyOn(algorand, 'Algorand')
    .mockImplementation(() => mockAlgorand as unknown as algorand.Algorand);
  beforeEach(() => {
    // Create mocks
    mockAlgoNFTAssetService = mock(AlgoNFTAssetService);
    mockRewardsService = mock(RewardsService);

    // Register mocks in the container
    container.register(AlgoNFTAssetService, { useValue: instance(mockAlgoNFTAssetService) });
    container.register(RewardsService, { useValue: instance(mockRewardsService) });

    // Create mocks
    player = mockedFakePlayer();
    when(
      mockAlgoNFTAssetService.assetEndGameUpdate(anything(), anything(), anything()),
    ).thenResolve(player.playableNFT as unknown as AlgoNFTAsset);
  });
  afterEach(() => {
    container.clearInstances();
    container.reset();
  });
  test('should return that the player is not an npc', () => {
    expect(player.isNpc).toBeFalsy();
  });
  test('should attempt to update the stats', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: false,
      payout: 0,
    };
    const expectedCallToEndGame = {
      wins: 0,
      losses: 1,
      zen: 0,
    };
    await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
    expect(player.coolDownModified).toBeFalsy();
    expect(player.randomCoolDown).toBe(0);
    verify(
      mockAlgoNFTAssetService.assetEndGameUpdate(
        deepEqual(player.playableNFT._id),
        0,
        deepEqual(expectedCallToEndGame),
      ),
    ).once();
    verify(
      mockRewardsService.issueTemporaryTokens(anything(), anything(), anything(), anything()),
    ).never();
  });
  test('check if cooldown is modified when it is and not zen even though zen is modified', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: true,
      payout: 0,
    };
    const expectedCallToEndGame = {
      wins: 0,
      losses: 1,
      zen: 0,
    };

    await player.userAndAssetEndGameUpdate(gameWinInfo, 1);
    expect(player.coolDownModified).toBeTruthy();
    expect(player.randomCoolDown).toBe(0);
    verify(
      mockAlgoNFTAssetService.assetEndGameUpdate(
        deepEqual(player.playableNFT._id),
        0,
        deepEqual(expectedCallToEndGame),
      ),
    ).once();
    verify(
      mockRewardsService.issueTemporaryTokens(anything(), anything(), anything(), anything()),
    ).never();
  });
  test('check if cooldown is modified when it is and zen is modified', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: true,
      payout: 0,
    };
    const expectedCallToEndGame = {
      wins: 1,
      losses: 0,
      zen: 1,
    };

    player.isWinner = true;
    await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
    expect(player.coolDownModified).toBeFalsy();
    expect(player.randomCoolDown).toBe(0);
    verify(
      mockAlgoNFTAssetService.assetEndGameUpdate(
        deepEqual(player.playableNFT._id),
        0,
        deepEqual(expectedCallToEndGame),
      ),
    ).once();

    verify(
      mockRewardsService.issueTemporaryTokens(
        player.dbUser._id,
        anything(),
        player.gameAssetIndex,
        0,
      ),
    ).once();
  });
  test('should handle an error', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: true,
      payout: 0,
    };
    player.isWinner = true;
    player.updateAsset = jest.fn().mockRejectedValueOnce(new Error('test'));
    await expect(player.userAndAssetEndGameUpdate(gameWinInfo, 0)).rejects.toThrow('test');
    expect(player.coolDownModified).toBeFalsy();
    expect(player.randomCoolDown).toBe(0);
    expect(player.updateAsset).toHaveBeenCalledTimes(1);
    verify(
      mockRewardsService.issueTemporaryTokens(anything(), anything(), anything(), anything()),
    ).never();
  });
  test('should return because the user is an NPC', async () => {
    player.playableNFT._id = 1;
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: false,
      payout: 0,
    };
    expect(player.isNpc).toBeTruthy();
    await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
  });
});
