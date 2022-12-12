import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import {
    ApplicationCommandOptionType,
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
} from 'discord.js';
import { Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';
import { injectable } from 'tsyringe';

import { AlgoStdAsset } from '../entities/AlgoStdAsset.js';
import { AlgoTxn } from '../entities/AlgoTxn.js';
import { User } from '../entities/User.js';
import { txnTypes } from '../enums/dtEnums.js';
import { Algorand } from '../services/Algorand.js';
import { Database } from '../services/Database.js';
import { yesNoButtons } from '../utils/functions/algoEmbeds.js';
import logger from '../utils/functions/LoggerFactory.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
export default class KarmaCommand {
    constructor(private algorand: Algorand, private db: Database) {}
    @Guard(PermissionGuard(['Administrator']))
    @Slash({
        description: 'Add Karma to a user',
        name: 'add',
    })
    @Category('Admin')
    @SlashGroup('karma')
    async add(
        @SlashOption({
            description: 'Discord User',
            name: 'username',
            required: true,
            type: ApplicationCommandOptionType.User,
        })
        username: GuildMember,
        @SlashOption({
            description: 'Amount To Add',
            name: 'amount',
            required: true,
            type: ApplicationCommandOptionType.Number,
        })
        amount: number,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const user = await this.db.get(User).getUserById(caller.id);
        await this.db.get(User).addKarma(caller.id, amount);
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Added ${amount.toLocaleString()} KARMA to ${username} -- Now has ${user.karma.toLocaleString()} KARMA`
        );
    }
    @Category('Karma')
    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async karmaClaim(interaction: CommandInteraction): Promise<void> {
        await this.claim(interaction);
    }

    @Category('Karma')
    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @SlashGroup('karma')
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async claim(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const user = await this.db.get(User).getUserById(caller.id);
        const rxWallet = await this.db.get(User).getRXWallet(caller.id);
        if (!rxWallet) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                'You do not have a wallet validated that can receive KARMA\n Add a wallet with `/wallet add` that is OPTED IN to the KARMA token\n Check your wallet with `/wallet list`'
            );
            return;
        }
        if (user.karma == 0) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You don't have any KARMA to claim!`
            );
            return;
        }
        let karmaAsset: AlgoStdAsset;
        try {
            karmaAsset = await this.db.get(AlgoStdAsset).getStdAssetByUnitName('KRMA');
        } catch (_e) {
            logger.info('Error getting KRMA Asset');
            await InteractionUtils.replyOrFollowUp(
                interaction,

                'Whoops tell the bot owner that the KRMA asset is not in the database'
            );
            return;
        }
        if (karmaAsset) {
            let buttonRow = yesNoButtons('claim');
            const message = await interaction.followUp({
                components: [buttonRow],
                content: `__**Are you sure you want to claim ${user.karma.toLocaleString()} KARMA?**__\n _This will be sent to your designated wallet:_\n ${ObjectUtil.ellipseAddress(
                    rxWallet?.walletAddress
                )}`,
            });
            let msg = 'There was an error claiming your KARMA';

            const collector = message.createMessageComponentCollector();
            collector.on('collect', async (collectInteraction: ButtonInteraction) => {
                await collectInteraction.deferUpdate();
                await collectInteraction.editReply({ components: [] });

                if (collectInteraction.customId.includes('yes')) {
                    await this.db.get(AlgoTxn).addPendingTxn(caller.id, user.karma);
                    let claimStatus = await this.algorand.claimToken(
                        karmaAsset.assetIndex,
                        user.karma,
                        rxWallet.walletAddress
                    );
                    // Clear users Karma
                    user.karma = 0;
                    await this.db.get(User).flush();
                    if (claimStatus.txId) {
                        logger.info(
                            `Claimed ${claimStatus.status?.txn.txn.aamt} KARMA for ${caller.id} -- ${collectInteraction.user.username}`
                        );
                        msg = 'Transaction Successful\n';
                        msg += `Txn ID: ${claimStatus.txId}\n`;
                        msg += `Txn Hash: ${claimStatus.status?.['confirmed-round']}\n`;
                        msg += `Transaction Amount: ${claimStatus.status?.txn.txn.aamt}\n`;
                        msg += `https://algoexplorer.io/tx/${claimStatus.txId}`;

                        await this.db.get(AlgoTxn).addTxn(caller.id, txnTypes.CLAIM, claimStatus);
                    }
                    await collectInteraction.editReply(msg);
                }
                if (collectInteraction.customId.includes('no')) {
                    await collectInteraction.editReply('No problem! Come back when you are ready!');
                }
                collector.stop();
            });
        }
    }
}
