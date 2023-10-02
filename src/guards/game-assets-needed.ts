import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';
import { container } from 'tsyringe';

import { GameAssets } from '../model/logic/game-assets.js';
import { getDeveloperMentions, InteractionUtils } from '../utils/utils.js';
const gameAssets = container.resolve(GameAssets);

export function GameAssetsNeeded(
    argument: CommandInteraction,
    _client: Client,
    next: Next
): Promise<unknown> {
    if (!gameAssets.isReady()) {
        return InteractionUtils.replyOrFollowUp(argument, {
            ephemeral: false,
            content: `Whoops! The game assets are not ready yet!\nCommand aborted\nTell the bot owner ${getDeveloperMentions()}`,
        });
    }
    return next();
}
