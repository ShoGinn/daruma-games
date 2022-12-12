import InteractionUtils = DiscordUtils.InteractionUtils;
import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';

import { DiscordUtils } from '../utils/Utils.js';

export function BotOwnerOnly(
    arg: CommandInteraction,
    client: Client,
    next: Next
): Promise<unknown> {
    const userId = arg?.user?.id;
    const botOwnerId = process.env.BOT_OWNER_ID;
    if (userId !== botOwnerId) {
        return InteractionUtils.replyOrFollowUp(arg, 'unauthorized');
    }
    return next();
}
