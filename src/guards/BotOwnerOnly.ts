import InteractionUtils = DiscordUtils.InteractionUtils;
import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';

import { generalConfig } from '../config/general.js';
import { DiscordUtils } from '../utils/Utils.js';

export function BotOwnerOnly(
    arg: CommandInteraction,
    client: Client,
    next: Next
): Promise<unknown> {
    const userId = arg?.user?.id;
    if (userId !== generalConfig.ownerId) {
        return InteractionUtils.replyOrFollowUp(arg, 'unauthorized');
    }
    return next();
}
