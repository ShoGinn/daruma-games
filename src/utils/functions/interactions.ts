import { ButtonInteraction, CommandInteraction } from 'discord.js';
import { SimpleCommandMessage } from 'discordx';

/**
 * Abstraction level to reply to either a slash command or a simple command message.
 * @param interaction
 * @param message
 */
export async function replyToInteraction(
    interaction: CommandInteraction | ButtonInteraction | SimpleCommandMessage,
    message: string | { [key: string]: any }
): Promise<void> {
    if (interaction instanceof CommandInteraction) await interaction.followUp(message);
    else if (interaction instanceof SimpleCommandMessage) await interaction.message.reply(message);
    else if (interaction instanceof ButtonInteraction) await interaction.reply(message);
}
