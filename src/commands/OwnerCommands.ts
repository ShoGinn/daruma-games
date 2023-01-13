import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, EnumChoice } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    CommandInteraction,
    MessageContextMenuCommandInteraction,
} from 'discord.js';
import { ContextMenu, Discord, Guard, Slash, SlashChoice, SlashGroup, SlashOption } from 'discordx';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingManager } from './DarumaTraining.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { DarumaTrainingChannel } from '../entities/DtChannel.js';
import { GameTypes } from '../enums/dtEnums.js';
import { BotOwnerOnly } from '../guards/BotOwnerOnly.js';
import { Algorand } from '../services/Algorand.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@SlashGroup({ description: 'Dev Commands', name: 'dev' })
@Category('Developer')
@Guard(BotOwnerOnly)
export default class DevCommands {
    constructor(private algoRepo: Algorand, private orm: MikroORM) {}
    @Slash({
        name: 'join',
        description: 'Have the bot join a dojo channel!',
    })
    @SlashGroup('dev')
    async join(
        @SlashOption({
            description: 'Channel to join',
            name: 'channel',
            required: true,
            type: ApplicationCommandOptionType.Channel,
        })
        channelName: string,
        @SlashChoice(...EnumChoice(GameTypes))
        @SlashOption({
            description: 'Game type',
            name: 'game_type',
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        channelType: GameTypes,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const waitingRoom = container.resolve(DarumaTrainingManager);
        const channelId = ObjectUtil.onlyDigits(channelName.toString());
        await em.getRepository(DarumaTrainingChannel).addChannel(channelId, channelType);
        waitingRoom.startWaitingRooms();
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Joined ${channelName}, with the default settings!`
        );
    }
    @ContextMenu({
        name: 'Start Waiting Room',
        type: ApplicationCommandType.Message,
    })
    async startWaitingRoomAgain(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const waitingRoom = container.resolve(DarumaTrainingManager);

        await InteractionUtils.replyOrFollowUp(interaction, 'Starting waiting room again...');
        waitingRoom.startWaitingRooms();
    }

    @ContextMenu({ name: 'Leave Dojo', type: ApplicationCommandType.Message })
    async leave(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const message = await InteractionUtils.getMessageFromContextInteraction(interaction);
        const channelId = message.channelId;
        const channelName = `<#${message.channelId}>`;

        // Remove all but digits from channel name
        //const channelId = onlyDigits(channelName.toString())
        const channelMsgId = await em
            .getRepository(DarumaTrainingChannel)
            .getChannelMessageId(channelId);
        if (channelMsgId) {
            try {
                await interaction.channel?.messages.delete(channelMsgId);
            } catch (error) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,

                    `I couldn't delete the message!\nAttempting to leave the channel anyway...`
                );
            }
            const channelExists = await em
                .getRepository(DarumaTrainingChannel)
                .removeChannel(channelId);
            if (channelExists) {
                await InteractionUtils.replyOrFollowUp(interaction, `Left ${channelName}!`);
            } else {
                await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelName}!`);
            }
            return;
        }
        await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelName}!`);
    }
    @Slash({
        name: 'sync_all_user_assets',
        description: 'Sync All User Assets',
    })
    @SlashGroup('dev')
    async syncAllUserAssets(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        await interaction.followUp(`Forcing an Out of Cycle User Asset Sync...`);

        const msg = await this.algoRepo.userAssetSync();
        await interaction.editReply(msg);
    }

    @Slash({
        name: 'clear_all_cds',
        description: 'Clear every user cooldown!!!!! (Owner Only)',
    })
    @SlashGroup('dev')
    async clearEveryCoolDown(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.followUp(`Clearing all the cool downs for all users...`);
        const em = this.orm.em.fork();
        await em.getRepository(AlgoWallet).clearCoolDownsForAllDiscordUsers();
        await interaction.editReply('All cool downs cleared');
    }
}
