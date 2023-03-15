import { Category, EnumChoice } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    CommandInteraction,
    GuildChannel,
    MessageContextMenuCommandInteraction,
} from 'discord.js';
import { ContextMenu, Discord, Guard, Slash, SlashChoice, SlashGroup, SlashOption } from 'discordx';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingManager } from './DarumaTraining.js';
import { AlgoWallet } from '../entities/AlgoWallet.entity.js';
import { DarumaTrainingChannel } from '../entities/DtChannel.entity.js';
import { User } from '../entities/User.entity.js';
import { GameTypes } from '../enums/dtEnums.js';
import { BotOwnerOnly } from '../guards/BotOwnerOnly.js';
import { GameAssetsNeeded } from '../guards/GameAssetsNeeded.js';
import { GameAssets } from '../model/logic/gameAssets.js';
import { Algorand } from '../services/Algorand.js';
import { InteractionUtils } from '../utils/Utils.js';
@Discord()
@injectable()
@SlashGroup({ description: 'Dev Commands', name: 'dev' })
@Category('Developer')
@Guard(BotOwnerOnly)
export default class DevelopmentCommands {
    constructor(private orm: MikroORM, private gameAssets: GameAssets) {}
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
        channel: GuildChannel,
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

        await em.getRepository(DarumaTrainingChannel).addChannel(channel, channelType);
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Joining ${channel}, with the default settings!`
        );

        await waitingRoom.startWaitingRoomForChannel(channel);
    }
    @ContextMenu({
        name: 'Start Waiting Room',
        type: ApplicationCommandType.Message,
    })
    async startWaitingRoomAgain(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const waitingRoom = container.resolve(DarumaTrainingManager);

        await InteractionUtils.replyOrFollowUp(interaction, 'Starting waiting room again...');
        const channel = interaction.channel;
        if (!channel) {
            await InteractionUtils.replyOrFollowUp(interaction, 'Channel not found!');
            return;
        }
        if (!(await waitingRoom.startWaitingRoomForChannel(channel))) {
            await InteractionUtils.replyOrFollowUp(interaction, 'There was a problem...');
            return;
        }
    }

    @ContextMenu({ name: 'Leave Dojo', type: ApplicationCommandType.Message })
    async leave(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const channel = interaction.channel;
        const channelMessageId = await em
            .getRepository(DarumaTrainingChannel)
            .getChannelMessageId(channel?.id);
        if (channelMessageId && channel) {
            try {
                await interaction.channel?.messages.delete(channelMessageId);
            } catch {
                await InteractionUtils.replyOrFollowUp(
                    interaction,

                    `I couldn't delete the message!\nAttempting to leave the channel anyway...`
                );
            }
            const channelExists = await em
                .getRepository(DarumaTrainingChannel)
                .removeChannel(channel);
            await (channelExists
                ? InteractionUtils.replyOrFollowUp(interaction, `Left ${channel}!`)
                : InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channel}!`));
            return;
        }
        await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channel}!`);
    }
    @Slash({
        name: 'sync_all_user_assets',
        description: 'Sync All User Assets',
    })
    @SlashGroup('dev')
    async syncAllUserAssets(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        InteractionUtils.replyOrFollowUp(interaction, `Forcing an Out of Cycle User Asset Sync...`);

        const em = this.orm.em.fork();
        const message = await em.getRepository(User).userAssetSync();
        await InteractionUtils.replyOrFollowUp(interaction, { content: message, ephemeral: true });
    }

    @Slash({
        name: 'clear_all_cds',
        description: 'Clear every user cooldown!!!!! (Owner Only)',
    })
    @SlashGroup('dev')
    async clearEveryCoolDown(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        InteractionUtils.replyOrFollowUp(
            interaction,
            `Clearing all the cool downs for all users...`
        );
        const em = this.orm.em.fork();
        await em.getRepository(AlgoWallet).clearAssetCoolDownsForAllUsers();
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: 'All cool downs cleared',
            ephemeral: true,
        });
    }
    @Slash({
        name: 'atomic_claim',
        description: 'Force claim for all wallets above threshold (Owner Only)',
    })
    @SlashGroup('dev')
    @Guard(GameAssetsNeeded)
    async forceAtomicClaim(
        @SlashOption({
            description: 'The threshold to claim for all users above',
            name: 'threshold',
            required: true,
            type: ApplicationCommandOptionType.Number,
        })
        threshold: number,
        interaction: CommandInteraction
    ): Promise<void> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');

        await interaction.deferReply({ ephemeral: true });
        InteractionUtils.replyOrFollowUp(
            interaction,
            `Attempting to claim all unclaimed assets for all users above ${threshold}..`
        );
        const algorand = container.resolve(Algorand);
        algorand.unclaimedAutomated(threshold, this.gameAssets.karmaAsset);
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: 'Completed',
            ephemeral: true,
        });
    }
}
