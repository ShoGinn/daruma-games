import {
  ApplicationCommandOptionType,
  ButtonInteraction,
  CommandInteraction,
  inlineCode,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { ButtonComponent, Client, Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';

import dayjs from 'dayjs';
import { inject, injectable } from 'tsyringe';

import { DarumaTrainingChampions } from '../services/dt-champions.js';
import { DiscordId } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { allDarumaStats, flexDaruma, paginatedDarumaEmbed } from '../utils/functions/dt-embeds.js';

import { DojoCommandService } from './dojo.service.js';

@Discord()
@injectable()
@Category('Dojo')
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
  constructor(
    private client: Client,
    @inject(DojoCommandService) private dojoCommandService: DojoCommandService,
    @inject(DarumaTrainingChampions) private dtChampions: DarumaTrainingChampions,
  ) {}
  @Slash({
    name: 'channel',
    description: 'Show the current channel settings',
  })
  @SlashGroup('dojo')
  async settings(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Get channel id from interaction
    const { channelId } = interaction;

    const embed = await this.dojoCommandService.channelSettings(channelId);
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @Slash({
    name: 'daruma',
    description: 'Setup your Daruma Customization',
  })
  @SlashGroup('dojo')
  async daruma(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await paginatedDarumaEmbed(interaction);
  }
  @Slash({
    name: 'flex',
    description: 'Flex your Daruma Collection!',
  })
  async flex(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await paginatedDarumaEmbed(interaction);
  }

  @Slash({
    name: 'ranking',
    description: 'Shows the top 20 ranking Daruma in the Dojos',
  })
  @SlashGroup('dojo')
  async dojoRanking(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.dojoCommandService.dojoRankings(this.client);
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @Guard(RateLimit(TIME_UNIT.seconds, 20, { ephemeral: true }))
  @ButtonComponent({ id: /((daruma-flex)\S*)\b/gm })
  async selectPlayer(interaction: ButtonInteraction): Promise<void> {
    await flexDaruma(interaction);
  }
  @ButtonComponent({ id: 'daruma-all-stats' })
  async allMyDarumaStats(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await allDarumaStats(interaction);
  }
  @ButtonComponent({ id: 'daruma-top20-stats' })
  async top20DarumaStats(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const winsRatio = await this.dojoCommandService.top20DarumaStats();

    await paginatedDarumaEmbed(interaction, undefined, winsRatio);
  }
  @Slash({
    name: 'rounds_per_game_type',
    description: 'Rounds Per Game Type!',
  })
  @SlashGroup('dojo')
  async maxRoundsPerGameType(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embeds = await this.dojoCommandService.maxRoundsPerGameType();

    await InteractionUtils.replyOrFollowUp(interaction, embeds);
  }
  @Slash({
    name: 'all_holders',
    description: 'All Daruma Holders!',
  })
  @SlashGroup('dojo')
  async allHoldersChart(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embeds = await this.dojoCommandService.allHoldersChart();

    await InteractionUtils.replyOrFollowUp(interaction, embeds);
  }

  @Slash({
    name: 'top20',
    description: 'Top Daruma Holders!',
  })
  @SlashGroup('dojo')
  async topHolders(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const embed = await this.dojoCommandService.topDarumaHolders(this.client);

    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ButtonComponent({ id: 'showCoolDowns' })
  async coolDownButton(interaction: ButtonInteraction): Promise<void> {
    await this.cd(interaction);
  }
  @Slash({
    name: 'cd',
    description: 'Check your Cool downs!',
  })
  @SlashGroup('dojo')
  async dojoCd(interaction: CommandInteraction): Promise<void> {
    await this.cd(interaction);
  }
  @Slash({
    name: 'cd',
    description: 'Check your Cool downs!',
  })
  async cd(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const coolDownPages = await this.dojoCommandService.showCoolDowns(caller.id as DiscordId);
    const pagination = new Pagination(
      interaction,
      coolDownPages.map((embed) => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
      },
    );
    await pagination.send();
  }
  @Slash({
    name: 'champions',
    description: 'Get the daily champions!',
  })
  @SlashGroup('dojo')
  @Guard(PermissionGuard(['Administrator']))
  async getChampions(
    @SlashOption({
      description: 'Number of champions to get',
      name: 'number',
      required: false,
      type: ApplicationCommandOptionType.Integer,
    })
    @SlashOption({
      description: 'Date to get champions for (defaults to yesterday UTC)',
      name: 'battle_date',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    number: number,
    battle_date: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });
    // Check if the number is valid
    if (!number) {
      number = 1;
    }
    if (number <= 0) {
      throw new Error('Number must be greater than 0');
    }
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Getting ${number} champion(s) for ${battle_date ?? 'yesterday'}`,
    );
    // Check if the date is valid
    if (battle_date) {
      const startDate = dayjs(battle_date);
      // Check if the dates are valid
      if (!startDate.isValid()) {
        throw new Error(
          `Invalid date format. ISO 8601 is required\n\n
        Server Timezone converted to UTC is used for the date\n
        Examples:\n
        ${inlineCode(dayjs().toISOString())}
        ${inlineCode(dayjs().format('YYYY-MM-DD HH:MM[Z]'))}
        \n\n A space is allowed between the date and time instead of the T`,
        );
      }
    } else {
      // If no date is provided, get yesterday's date
      battle_date = dayjs().subtract(1, 'day').toISOString();
    }
    // convert the dayJS date to a date object
    const championPickDate = dayjs(battle_date).toDate();
    const champions = await this.dtChampions.getRandomNumberOfChampionsByDate(
      championPickDate,
      number,
    );
    const championRecords = await this.dtChampions.createChampionRecord(champions);
    const championEmbed = await this.dtChampions.buildChampionEmbed(championRecords);
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Champions for ${championPickDate.toDateString()}\n\n${championEmbed}`,
    );
  }
}
