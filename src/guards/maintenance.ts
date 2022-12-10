import { ButtonInteraction, CommandInteraction, ContextMenuCommandInteraction } from 'discord.js';
import { ArgsOf, GuardFunction, SimpleCommandMessage } from 'discordx';
import { isDev } from '../utils/functions/devs.js';
import { replyToInteraction } from '../utils/functions/interactions.js';
import { isInMaintenance } from '../utils/functions/maintenance.js';

/**
 * Prevent interactions from running when bot is in maintenance
 */
export const Maintenance: GuardFunction<ArgsOf<'messageCreate' | 'interactionCreate'>> = async (
    arg,
    client,
    next
) => {
    if (
        arg instanceof CommandInteraction ||
        arg instanceof SimpleCommandMessage ||
        arg instanceof ContextMenuCommandInteraction ||
        arg instanceof ButtonInteraction
    ) {
        const user = arg.,
            maintenance = await isInMaintenance();

        if (maintenance && user?.id && !isDev(user.id)) {

            if (
                arg instanceof CommandInteraction ||
                arg instanceof SimpleCommandMessage ||
                arg instanceof ButtonInteraction
            )
                await replyToInteraction(arg, 'Bot is in maintenance mode, please try again later');
        } else return next();
    } else return next();
};
function resolveUser(arg: ([message: import("discord.js").Message<boolean>] & CommandInteraction<any>) | ([interaction: import("discord.js").Interaction<import("discord.js").CacheType>] & CommandInteraction<any>) | ([message: ...] & SimpleCommandMessage) | ([interaction: ...] & SimpleCommandMessage) | ([message: ...] & ButtonInteraction<...>) | ([interaction: ...] & ButtonInteraction<...>)) {
  throw new Error('Function not implemented.');
}

