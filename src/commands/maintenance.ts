import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';
import { Client, Discord, Guard, Slash, SlashOption } from 'discordx';

import { Disabled } from '../guards/disabled.js';
import { simpleSuccessEmbed } from '../utils/functions/embeds.js';
import { setMaintenance } from '../utils/functions/maintenance.js';

@Discord()
export default class MaintenanceCommand {
    @Slash({
        name: 'maintenance',
        description: 'Turn maintenance mode on or off',
    })
    @Guard(Disabled)
    async maintenance(
        @SlashOption({
            name: 'state',
            description: 'Whether to turn maintenance mode on or off',
            type: ApplicationCommandOptionType.Boolean,
            required: true,
        })
        state: boolean,
        interaction: CommandInteraction,
        client: Client,
        { localize }: InteractionData
    ): Promise<void> {
        await setMaintenance(state);

        await simpleSuccessEmbed(
            interaction,
            localize.COMMANDS.MAINTENANCE.EMBED.DESCRIPTION({
                state: state ? 'on' : 'off',
            })
        );
    }
}
