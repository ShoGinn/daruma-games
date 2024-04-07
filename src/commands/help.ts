import {
  ActionRowBuilder,
  CommandInteraction,
  EmbedBuilder,
  inlineCode,
  InteractionResponse,
  Message,
  SelectMenuComponentOptionData,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { ICategory } from '@discordx/utilities';
import {
  Client,
  DApplicationCommand,
  Discord,
  Guard,
  MetadataStorage,
  SelectMenuComponent,
  Slash,
} from 'discordx';

import chunk from 'lodash/chunk.js';
import isString from 'lodash/isString.js';

import { GuildOnly } from '../guards/guild-only.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';

type CatCommand = DApplicationCommand & ICategory;

@Discord()
export class Help {
  private readonly _catMap = new Map<string, CatCommand[]>();

  public constructor() {
    const commands: CatCommand[] = MetadataStorage.instance
      .applicationCommandSlashesFlat as CatCommand[];
    for (const command of commands) {
      const { category } = command;
      if (category) {
        if (!isString(category)) {
          continue;
        }
        if (this._catMap.has(category)) {
          this._catMap.get(category)?.push(command);
        } else {
          this._catMap.set(category, [command]);
        }
      }
    }
  }

  @Slash({
    description: 'Get the description of all commands',
  })
  @Guard(GuildOnly)
  public async help(
    interaction: CommandInteraction,
    client: Client,
  ): Promise<InteractionResponse | Message> {
    await interaction.deferReply({ ephemeral: true, fetchReply: true });
    const embed = this.displayCategory(client);
    const selectMenu = this.getSelectDropdown();
    return await InteractionUtils.replyOrFollowUp(interaction, {
      embeds: [embed],
      components: [selectMenu],
    });
  }

  private displayCategory(
    client: Client,
    category: string = 'categories',
    pageNumber: number = 0,
  ): EmbedBuilder {
    if (category === 'categories') {
      const embed = new EmbedBuilder()
        .setTitle(`${client.user?.username ?? 'Bot'} commands`)
        .setColor('Aqua')
        .setDescription(`The items shown below are all the commands supported by this bot`)
        .setFooter({
          text: client.user?.username ?? 'Bot',
        })
        .setTimestamp();
      for (const [cat] of this._catMap) {
        const description = `${cat} Commands`;
        embed.addFields(ObjectUtil.singleFieldBuilder(cat, description));
      }
      return embed;
    }

    const commands = this._catMap.get(category) ?? [];
    const chunks = chunk(commands, 24);
    const maxPage = chunks.length;
    const resultOfPage = chunks[pageNumber];
    const embed = new EmbedBuilder()
      .setTitle(`${category} Commands:`)
      .setColor('Aqua')
      .setFooter({
        text: `${client.user?.username ?? 'Bot'} :white_small_square: Page ${
          pageNumber + 1
        } of ${maxPage}`,
      })
      .setTimestamp();
    if (!resultOfPage) {
      return embed;
    }
    for (const item of resultOfPage) {
      const { description: itemDescription, name: itemName, group: itemGroup } = item;
      const fieldValue = isString(itemDescription) ? itemDescription : 'No description';

      const resultName = isString(itemGroup) ? `/${itemGroup} ${itemName}` : `/${itemName}`;
      const nameToDisplay = inlineCode(resultName);
      embed.addFields(
        ObjectUtil.singleFieldBuilder(nameToDisplay, fieldValue, resultOfPage.length > 5),
      );
    }
    return embed;
  }

  private getSelectDropdown(
    defaultValue: string = 'categories',
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    const optionsForEmbed: SelectMenuComponentOptionData[] = [];
    optionsForEmbed.push({
      description: 'View all categories',
      label: 'Categories',
      value: 'categories',
      default: defaultValue === 'categories',
    });
    for (const [cat] of this._catMap) {
      const description = `${cat} Commands`;
      optionsForEmbed.push({
        description,
        label: cat,
        value: cat,
        default: defaultValue === cat,
      });
    }
    const selectMenu = new StringSelectMenuBuilder()
      .addOptions(optionsForEmbed)
      .setCustomId('help-category-selector');
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  }

  @SelectMenuComponent({
    id: 'help-category-selector',
  })

  // @ts-expect-error - This is a decorated function
  private async selectCategory(
    interaction: StringSelectMenuInteraction,
    client: Client,
  ): Promise<InteractionResponse> {
    const catToShow = interaction.values[0];
    const categoryEmbed = this.displayCategory(client, catToShow);
    const selectMenu = this.getSelectDropdown(catToShow);
    return await interaction.update({
      embeds: [categoryEmbed],
      components: [selectMenu],
    });
  }
}
