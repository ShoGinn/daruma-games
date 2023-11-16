/* eslint-disable @typescript-eslint/unbound-method */
import { GameWinInfo } from '../../src/types/daruma-training.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { mockAlgorand } from '../mocks/mock-algorand-functions.js';
import { mockedFakePlayer } from '../utils/fake-mocks.js';

jest.mock('../../src/services/algorand.js', () => ({
  Algorand: jest.fn().mockImplementation(() => mockAlgorand),
}));
jest.mock('../../src/utils/functions/dt-utils.js', () => ({
  rollForCoolDown: jest.fn().mockReturnValue(0),
}));
describe('The Player class', () => {
  let player: Player;
  beforeEach(() => {
    player = mockedFakePlayer();
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
    await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
    expect(player.coolDownModified).toBeFalsy();
    expect(player.randomCoolDown).toBe(0);
    expect(player.updateAsset).toHaveBeenCalledTimes(1);
    expect(player.updateWinner).toHaveBeenCalledTimes(1);
    expect(player.updateAsset).toHaveBeenCalledWith({
      wins: 0,
      losses: 1,
      zen: 0,
    });
  });
  test('check if cooldown is modified when it is and not zen even though zen is modified', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: true,
      payout: 0,
    };
    await player.userAndAssetEndGameUpdate(gameWinInfo, 1);
    expect(player.coolDownModified).toBeTruthy();
    expect(player.randomCoolDown).toBe(0);
    expect(player.updateAsset).toHaveBeenCalledTimes(1);
    expect(player.updateWinner).toHaveBeenCalledTimes(1);
    expect(player.updateAsset).toHaveBeenCalledWith({
      wins: 0,
      losses: 1,
      zen: 0,
    });
  });
  test('check if cooldown is modified when it is and zen is modified', async () => {
    // await gameAssets.initializeKRMA();
    const gameWinInfo: GameWinInfo = {
      gameWinRollIndex: 0,
      gameWinRoundIndex: 0,
      zen: true,
      payout: 0,
    };
    player.isWinner = true;
    await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
    expect(player.coolDownModified).toBeFalsy();
    expect(player.randomCoolDown).toBe(0);
    expect(player.updateAsset).toHaveBeenCalledTimes(1);
    expect(player.updateWinner).toHaveBeenCalledTimes(1);
    expect(player.updateAsset).toHaveBeenCalledWith({
      wins: 1,
      losses: 0,
      zen: 1,
    });
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
    expect(player.updateWinner).toHaveBeenCalledTimes(0);
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
