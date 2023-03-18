import { CommandInteraction, ComponentType } from 'discord.js';
import { Discord, Slash } from 'discordx';

import { buildYesNoButtons } from '../utils/functions/algo-embeds.js';

@Discord()
export default class TestCommand {
    @Slash({
        description: 'Just a test command',
        name: 'collector',
    })
    async test(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();
        const buttonRow = buildYesNoButtons('claim');
        const message = await interaction.followUp({
            components: [buttonRow],
            content: 'test',
        });
        const collector = message.createMessageComponentCollector({
            max: 1,
            time: 10_000,
            componentType: ComponentType.Button,
        });
        collector.on('collect', interaction => {
            interaction.reply({
                content: 'test button',
                ephemeral: true,
            });
        });
        collector.on('end', collected => {
            interaction.channel?.send(`Collected ${collected.size} items`);
        });
    }
}
