import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../model/framework/manager/property-resolution-manager.js';
import { GameAssets } from '../model/logic/game-assets.js';
import { InteractionUtils } from '../utils/utils.js';
const gameAssets = container.resolve(GameAssets);
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

export function GameAssetsNeeded(
    argument: CommandInteraction,
    _client: Client,
    next: Next
): Promise<unknown> {
    const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;

    if (!gameAssets.isReady()) {
        return InteractionUtils.replyOrFollowUp(argument, {
            ephemeral: false,
            content: `Whoops! The game assets are not ready yet!\nCommand aborted\nTell the bot owner <@${botOwnerId}>`,
        });
    }
    return next();
}
