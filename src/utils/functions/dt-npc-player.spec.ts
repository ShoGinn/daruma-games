import { gameNPCs } from '../../enums/daruma-training.js';
import { Player } from '../classes/dt-player.js';

import { generateNPCPlayer } from './dt-npc-player.js';

describe('generateNPCPlayer', () => {
  it('should return undefined if no gameNPC is provided', () => {
    expect(generateNPCPlayer()).toBeUndefined();
  });

  it('should return a Player instance if a gameNPC is provided', () => {
    const gameNPC = gameNPCs[0]; // Use the first NPC for testing
    const player = generateNPCPlayer(gameNPC);
    expect(player).toBeInstanceOf(Player);
    expect(player?.dbUser._id).toBe('123456789');
    expect(player?.playableNFT._id).toBe(gameNPC!.assetIndex);
  });
});
