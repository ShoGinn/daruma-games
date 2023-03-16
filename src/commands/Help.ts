import { ICategory } from '@discordx/utilities';
import {
    ActionRowBuilder,
    CommandInteraction,
    EmbedBuilder,
    inlineCode,
    InteractionResponse,
    SelectMenuComponentOptionData,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import {
    Client,
    DApplicationCommand,
    Discord,
    Guard,
    MetadataStorage,
    SelectMenuComponent,
    Slash,
} from 'discordx';

import { GuildOnly } from '../guards/guild-only.js';
import { InteractionUtils, ObjectUtil } from '../utils/utils.js';

type CatCommand = DApplicationCommand & ICategory;

@Discord()
export class Help {
    private readonly _catMap: Map<string, Array<CatCommand>> = new Map();

    public constructor() {
        const commands: Array<CatCommand> = MetadataStorage.instance
            .applicationCommandSlashesFlat as Array<CatCommand>;
        for (const command of commands) {
            const { category } = command;
            if (category) {
                if (!ObjectUtil.isValidString(category)) {
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
    public async help(interaction: CommandInteraction, client: Client): Promise<void> {
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
        pageNumber: number = 0
    ): EmbedBuilder {
        if (category === 'categories') {
            const embed = new EmbedBuilder()
                .setTitle(`${client.user?.username} commands`)
                .setColor('#0099ff')
                .setDescription(`The items shown below are all the commands supported by this bot`)
                .setFooter({
                    text: `${client.user?.username}`,
                })
                .setTimestamp();
            for (const [cat] of this._catMap) {
                const description = `${cat} Commands`;
                embed.addFields(ObjectUtil.singleFieldBuilder(cat, description));
            }
            return embed;
        }

        const commands = this._catMap.get(category) ?? [];
        const chunks = ObjectUtil.chunkArray(commands, 24);
        const maxPage = chunks.length;
        const resultOfPage = chunks[pageNumber];
        const embed = new EmbedBuilder()
            .setTitle(`${category} Commands:`)
            .setColor('#0099ff')
            .setFooter({
                text: `${client.user?.username} • Page ${pageNumber + 1} of ${maxPage}`,
            })
            .setTimestamp();
        if (!resultOfPage) {
            return embed;
        }
        for (const item of resultOfPage) {
            const { description: itemDescription, name: itemName, group: itemGroup } = item;
            const fieldValue = ObjectUtil.isValidString(itemDescription)
                ? itemDescription
                : 'No description';

            const resultName = ObjectUtil.isValidString(itemGroup)
                ? `/${itemGroup} ${itemName}`
                : `/${itemName}`;
            const nameToDisplay = inlineCode(resultName);
            embed.addFields(
                ObjectUtil.singleFieldBuilder(nameToDisplay, fieldValue, resultOfPage.length > 5)
            );
        }
        return embed;
    }

    private getSelectDropdown(
        defaultValue: string = 'categories'
    ): ActionRowBuilder<StringSelectMenuBuilder> {
        const optionsForEmbed: Array<SelectMenuComponentOptionData> = [];
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
    private async selectCategory(
        interaction: StringSelectMenuInteraction,
        client: Client
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
