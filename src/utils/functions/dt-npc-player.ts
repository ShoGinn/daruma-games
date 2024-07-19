import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { gameNPCs, IGameNPC } from '../../enums/daruma-training.js';
import { DiscordId } from '../../types/core.js';
import { FakeAsset } from '../../types/daruma-training.js';
import { Player } from '../classes/dt-player.js';

import { gameStatusHostedUrl } from './dt-images.js';

// Generate NPC assets once and store them in a variable
const npcAssets: FakeAsset[] = gameNPCs.map((bot) => ({
  _id: bot.assetIndex,
  name: bot.name,
  unitName: bot.name,
  url: gameStatusHostedUrl(bot.gameType, 'npc'),
}));

export const generateNPCPlayer = (gameNPC: IGameNPC): Player => {
  // Use the pre-generated npcAssets instead of calling generateNPCAssets
  const fakeUser = {
    _id: '123456789' as DiscordId,
    artifactToken: 0,
  };

  const npc = npcAssets.find((npc) => npc._id === gameNPC.assetIndex) as AlgoNFTAsset;
  return new Player(fakeUser, npc, 1);
};
