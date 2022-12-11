import { PermissionGuard } from '@discordx/utilities';
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';
import { Discord, Guard, Slash, SlashOption } from 'discordx';

import { simpleSuccessEmbed } from '../utils/functions/embeds.js';
import { setMaintenance } from '../utils/functions/maintenance.js';

@Discord()
export default class MaintenanceCommand {
    @Slash({
        name: 'maintenance',
        description: 'Turn maintenance mode on or off',
    })
    @Guard(PermissionGuard['Administrator'])
    async maintenance(
        @SlashOption({
            name: 'state',
            description: 'Whether to turn maintenance mode on or off',
            type: ApplicationCommandOptionType.Boolean,
            required: true,
        })
        state: boolean,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await setMaintenance(state);

        await simpleSuccessEmbed(
            interaction,
            `Maintenance mode has been turned ${state ? 'on' : 'off'}`
        );
    }
}
