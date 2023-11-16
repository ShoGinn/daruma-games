import { CommandInteraction } from 'discord.js';

import { Client, Next } from 'discordx';

import { container } from 'tsyringe';

import { GameAssets } from '../services/game-assets.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { getDeveloperMentions } from '../utils/functions/owner-utils.js';

export function GameAssetsNeeded(
  argument: CommandInteraction,
  _client: Client,
  next: Next,
): Promise<unknown> {
  const gameAssets = container.resolve(GameAssets);

  if (!gameAssets.isReady()) {
    return InteractionUtils.replyOrFollowUp(argument, {
      ephemeral: false,
      content: `Whoops! The game assets are not ready yet!\nCommand aborted\nTell the bot owner ${getDeveloperMentions()}`,
    });
  }
  return next();
}
