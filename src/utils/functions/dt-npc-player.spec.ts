import { gameNPCs } from '../../enums/daruma-training.js';
import { Player } from '../classes/dt-player.js';

import { generateNPCPlayer } from './dt-npc-player.js';

describe('generateNPCPlayer', () => {
  it('should return undefined if gameNPC is undefined', () => {
    const result = generateNPCPlayer();
    expect(result).toBeUndefined();
  });

  it('should return a Player instance if gameNPC is defined', () => {
    const gameNPC = gameNPCs[0];
    const result = generateNPCPlayer(gameNPC);
    expect(result).toBeInstanceOf(Player);
    expect(result?.dbUser._id).toHaveLength(9);
    expect(result?.playableNFT._id).toBe(gameNPC!.assetIndex);
  });
});
