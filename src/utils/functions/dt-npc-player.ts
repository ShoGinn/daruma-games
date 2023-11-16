import { faker } from '@faker-js/faker';

import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { IUser } from '../../database/user/user.schema.js';
import { gameNPCs, IGameNPC } from '../../enums/daruma-training.js';
import { DiscordId } from '../../types/core.js';
import { FakeAsset } from '../../types/daruma-training.js';
import { Player } from '../classes/dt-player.js';

import { gameStatusHostedUrl } from './dt-images.js';

const generateNPCAssets = (): FakeAsset[] => {
  return gameNPCs.map((bot) => ({
    _id: bot.assetIndex,
    name: bot.name,
    unitName: bot.name,
    url: gameStatusHostedUrl(bot.gameType, 'npc'),
  }));
};

export const generateNPCPlayer = (gameNPC: IGameNPC | undefined): Player | undefined => {
  if (!gameNPC) {
    return;
  }
  const npc = generateNPCAssets().find((npc) => npc._id === gameNPC.assetIndex) as AlgoNFTAsset;
  return new Player(generateFakeUser(), npc, 1);
};
const generateFakeUser = (): IUser => ({
  _id: faker.string.numeric(9) as DiscordId,
  artifactToken: 0,
});
