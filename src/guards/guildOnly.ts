import { CommandInteraction } from 'discord.js';
import { GuardFunction, SimpleCommandMessage } from 'discordx';

import { replyToInteraction } from '../utils/functions/interactions.js';

/**
 * Prevent the command from running on DM
 */
export const GuildOnly: GuardFunction<CommandInteraction | SimpleCommandMessage> = async (
    arg,
    client,
    next
) => {
    const isInGuild = arg instanceof CommandInteraction ? arg.inGuild() : arg.message.guild;

    if (isInGuild) return await next();
    else {
        await replyToInteraction(arg, 'This command can only be used in a guild');
    }
};
