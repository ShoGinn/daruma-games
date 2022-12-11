import {
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    CommandInteraction,
    ContextMenuCommandInteraction,
    MentionableSelectMenuInteraction,
    Message,
    MessageReaction,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    StringSelectMenuInteraction,
    UserSelectMenuInteraction,
    VoiceState,
} from 'discord.js';
import { ArgsOf, GuardFunction, SimpleCommandMessage } from 'discordx';

import { isDev } from '../utils/functions/devs.js';
import { isInMaintenance } from '../utils/functions/maintenance.js';

/**
 * Guard to prevent any interaction during maintenance
 *
 * @param arg
 * @param client
 * @param next
 */
export const Maintenance: GuardFunction<
    | ArgsOf<'messageCreate' | 'messageReactionAdd' | 'voiceStateUpdate'>
    | ButtonInteraction
    | ChannelSelectMenuInteraction
    | CommandInteraction
    | ContextMenuCommandInteraction
    | MentionableSelectMenuInteraction
    | ModalSubmitInteraction
    | RoleSelectMenuInteraction
    | StringSelectMenuInteraction
    | UserSelectMenuInteraction
    | SimpleCommandMessage
> = async (arg, client, next) => {
    const argObj = arg instanceof Array ? arg[0] : arg;
    const maintenance = await isInMaintenance();

    const user =
        argObj instanceof CommandInteraction
            ? argObj.user
            : argObj instanceof MessageReaction
            ? argObj.message.author
            : argObj instanceof VoiceState
            ? argObj.member?.user
            : argObj instanceof Message
            ? argObj.author
            : argObj instanceof SimpleCommandMessage
            ? argObj.message.author
            : argObj instanceof ButtonInteraction ||
              argObj instanceof ChannelSelectMenuInteraction ||
              argObj instanceof CommandInteraction ||
              argObj instanceof ContextMenuCommandInteraction ||
              argObj instanceof MentionableSelectMenuInteraction ||
              argObj instanceof ModalSubmitInteraction ||
              argObj instanceof RoleSelectMenuInteraction ||
              argObj instanceof StringSelectMenuInteraction ||
              argObj instanceof UserSelectMenuInteraction
            ? argObj.member?.user
            : argObj.message.author;
    if (maintenance && user?.id && !isDev(user.id)) {
        // Make Sure we can reply to the user
        if (argObj instanceof CommandInteraction || argObj instanceof ButtonInteraction) {
            await argObj.reply({
                content: `Sorry, I'm currently in maintenance mode. Please try again later.`,
                ephemeral: true,
            });
        }
    } else {
        await next();
    }
};
