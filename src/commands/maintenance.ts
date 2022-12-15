import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, PermissionGuard } from '@discordx/utilities';
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';
import { Discord, Guard, Slash, SlashOption } from 'discordx';

import { setMaintenance } from '../utils/functions/maintenance.js';
import { DiscordUtils } from '../utils/Utils.js';

@Discord()
export default class MaintenanceCommand {
    @Category('Admin')
    @Slash({
        name: 'maintenance',
        description: 'Turn maintenance mode on or off',
    })
    @Guard(PermissionGuard(['Administrator']))
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

        await InteractionUtils.simpleSuccessEmbed(
            interaction,
            `Maintenance mode has been turned ${state ? 'on' : 'off'}`
        );
    }
}
