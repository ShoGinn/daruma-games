import { CommandInteraction, EmbedBuilder } from 'discord.js';

import { DiscordUtils } from '../Utils.js';

/**
 * Send a simple success embed
 * @param interaction - discord interaction
 * @param message - message to log
 */
export async function simpleSuccessEmbed(
    interaction: CommandInteraction,
    message: string
): Promise<void> {
    const embed = new EmbedBuilder()
        .setColor(0x57f287) // GREEN // see: https://github.com/discordjs/discord.js/blob/main/packages/discord.js/src/util/Colors.js
        .setTitle(`✅ ${message}`);

    await DiscordUtils.InteractionUtils.replyOrFollowUp(interaction, { embeds: [embed] });
}

/**
 * Send a simple error embed
 * @param interaction - discord interaction
 * @param message - message to log
 */
export async function simpleErrorEmbed(
    interaction: CommandInteraction,
    message: string
): Promise<void> {
    const embed = new EmbedBuilder()
        .setColor(0xed4245) // RED // see: https://github.com/discordjs/discord.js/blob/main/packages/discord.js/src/util/Colors.js
        .setTitle(`❌ ${message}`);

    await DiscordUtils.InteractionUtils.replyOrFollowUp(interaction, { embeds: [embed] });
}
