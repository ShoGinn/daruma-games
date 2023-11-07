import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';

import { Category, PermissionGuard } from '@discordx/utilities';
import { Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';

import { container } from 'tsyringe';

import { setMaintenance } from '../utils/functions/maintenance.js';
import { InteractionUtils } from '../utils/utils.js';

import { DarumaTrainingManager } from './daruma-training.js';

@Discord()
@Category('Admin')
@Guard(PermissionGuard(['Administrator']))
export default class MaintenanceCommand {
  @Slash({
    name: 'maintenance',
    description: 'Turn maintenance mode on or off',
  })
  @SlashGroup('dev')
  async maintenance(
    @SlashOption({
      name: 'state',
      description: 'Whether to turn maintenance mode on or off',
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    })
    state: boolean,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await setMaintenance(state);

    const waitingRoom = container.resolve(DarumaTrainingManager);
    await (state ? waitingRoom.stopWaitingRoomsOnceGamesEnd() : waitingRoom.startWaitingRooms());
    await InteractionUtils.simpleSuccessEmbed(
      interaction,
      `Maintenance mode has been turned ${state ? 'on' : 'off'}`,
    );
  }
}
