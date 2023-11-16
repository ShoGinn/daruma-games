import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';

import { Category, PermissionGuard } from '@discordx/utilities';
import { Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';

import { injectable } from 'tsyringe';

import { MaintenanceService } from '../services/maintenance.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';

import { DarumaTrainingManager } from './daruma-training.js';

@Discord()
@injectable()
@Category('Admin')
@Guard(PermissionGuard(['Administrator']))
export default class MaintenanceCommand {
  constructor(
    private maintenanceService: MaintenanceService,
    private waitingRoom: DarumaTrainingManager,
  ) {}
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
    await this.maintenanceService.setMaintenance(state);

    await (state
      ? this.waitingRoom.stopWaitingRoomsOnceGamesEnd()
      : this.waitingRoom.startWaitingRooms());
    await InteractionUtils.simpleSuccessEmbed(
      interaction,
      `Maintenance mode has been turned ${state ? 'on' : 'off'}`,
    );
  }
}
