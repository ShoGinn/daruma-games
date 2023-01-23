import InteractionUtils = DiscordUtils.InteractionUtils;
import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../model/framework/manager/PropertyResolutionManager.js';
import { GameAssets } from '../model/logic/gameAssets.js';
import { DiscordUtils } from '../utils/Utils.js';
const gameAssets = container.resolve(GameAssets);
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

export function GameAssetsNeeded(
    arg: CommandInteraction,
    client: Client,
    next: Next
): Promise<unknown> {
    const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;

    if (!gameAssets.ready) {
        return InteractionUtils.replyOrFollowUp(arg, {
            ephemeral: false,
            content: `Whoops! The game assets are not ready yet!\nCommand aborted\nTell the bot owner <@${botOwnerId}>`,
        });
    }
    return next();
}
