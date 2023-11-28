import {
  ActionRowBuilder,
  APIEmbedField,
  ApplicationCommandType,
  bold,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  User as DiscordUser,
  EmbedBuilder,
  inlineCode,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { BaseMessageOptions } from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { ButtonComponent, ContextMenu, Discord, Guard, ModalComponent, Slash } from 'discordx';

import { isValidAddress } from 'algosdk';
import { inject, injectable } from 'tsyringe';

import { NFDomainsManager } from '../manager/nf-domains.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { AlgoStdAssetsService } from '../services/algo-std-assets.js';
import { Algorand } from '../services/algorand.js';
import { RewardsService } from '../services/rewards.js';
import { StatsService } from '../services/stats.js';
import { UserService } from '../services/user.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { buildAddRemoveButtons, customButton } from '../utils/functions/algo-embeds.js';
import { paginatedDarumaEmbed } from '../utils/functions/dt-embeds.js';

@Discord()
@injectable()
@Category('Wallet')
export default class WalletCommand {
  constructor(
    @inject(Algorand) private algoRepo: Algorand,
    @inject(NFDomainsManager) private nfDomainsManager: NFDomainsManager,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(AlgoStdAssetsService) private algoStdAssetService: AlgoStdAssetsService,
    @inject(UserService) private userService: UserService,
    @inject(RewardsService) private rewardsService: RewardsService,
    @inject(StatsService) private statsService: StatsService,
  ) {}

  @ContextMenu({
    name: 'Clear User CD`s',
    type: ApplicationCommandType.User,
  })
  @Guard(PermissionGuard(['Administrator']))
  async userCoolDownClear(interaction: UserContextMenuCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Clearing all the cool downs for all @${interaction.targetUser.username} assets...`,
    );
    await this.algoNFTAssetService.clearAssetCoolDownsForUser(interaction.targetId as DiscordId);
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'All cool downs cleared',
      ephemeral: true,
    });
  }
  @Slash({ name: 'uprole', description: 'Not a command' })
  async uprole(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    // provide a response that this is not a server command
    await InteractionUtils.replyOrFollowUp(interaction, {
      content:
        'No need to use this command, the bot will automatically update your role.\nIf you are having issues, open a ticket in the support channel.',
      ephemeral: true,
    });
  }
  @Slash({ name: 'wallet', description: 'Manage Algorand Wallets and Daruma' })
  @Guard(RateLimit(TIME_UNIT.seconds, 10))
  async wallet(interaction: CommandInteraction): Promise<void> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    await this.sendWalletEmbeds({ interaction, discordUserId: caller.id as DiscordId });
  }
  @ButtonComponent({ id: 'walletSetup' })
  async walletSetup(interaction: ButtonInteraction): Promise<void> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    await this.sendWalletEmbeds({ interaction, discordUserId: caller.id as DiscordId });
  }
  @ButtonComponent({ id: /((simple-remove-userWallet_)\S*)\b/gm })
  async removeWallet(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const discordUserId = interaction.user.id as DiscordId;
    const address = interaction.customId.split('_')[1] as WalletAddress;
    if (!address) {
      throw new Error('No address found');
    }
    const response = await this.userService.removeWalletFromUser(address, discordUserId);
    const message = response.modifiedCount === 1 ? 'Wallet Removed' : 'Wallet not found';
    await InteractionUtils.replyOrFollowUp(interaction, message);
  }

  @ButtonComponent({ id: /((simple-add-userWallet_)\S*)\b/gm })
  async addWallet(interaction: ButtonInteraction): Promise<void> {
    // Create the modal
    const modal = new ModalBuilder()
      .setTitle('Add an Algorand Wallet')
      .setCustomId('addWalletModal');
    // Create text input fields
    const newWallet = new TextInputBuilder()
      .setCustomId('new-wallet')
      .setLabel('Wallet Address')
      .setStyle(TextInputStyle.Short);
    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newWallet);
    // Add action rows to form
    modal.addComponents(row1);
    // Present the modal to the user
    await interaction.showModal(modal);
  }
  @ModalComponent()
  async addWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
    const newWallet = interaction.fields.getTextInputValue('new-wallet') as WalletAddress;
    await interaction.deferReply({ ephemeral: true });
    if (!isValidAddress(newWallet)) {
      await interaction.editReply('Invalid Wallet Address');
      return;
    }
    const discordUser = interaction.user.id as DiscordId;
    const message = await this.userService.addWalletToUser(newWallet, discordUser);
    await interaction.editReply(message);
    return;
  }

  private async sendWalletEmbeds({
    interaction,
    discordUserId,
  }: {
    interaction: CommandInteraction | ButtonInteraction;
    discordUserId: DiscordId;
  }): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    // specific embed

    const wallets = (await this.userService.getUserWallets(discordUserId)) ?? [];
    const totalUserAssets = await this.statsService.getTotalAssetsByUser(discordUserId);
    const maxPage = wallets.length > 0 ? wallets.length : 1;
    const embedsObject: BaseMessageOptions[] = [];
    for (let index = 0; index < wallets.length; index++) {
      const currentWallet = wallets[index];
      if (!currentWallet) {
        continue;
      }
      const walletAssetCount = await this.statsService.getTotalAssetsByWallet(currentWallet);
      const { embed, optInButtons } = await this.getWalletEmbed({
        currentWallet: currentWallet,
        user: interaction.user,
      });
      embed.setTitle('Owned Wallets');
      embed.setDescription(
        `${bold(
          wallets.length.toLocaleString(),
        )} :file_folder: :white_small_square: ${walletAssetCount} assets`,
      );
      embed.setFooter({
        text: `Wallet ${index + 1} of ${maxPage} | Total Assets: ${totalUserAssets}`,
      });

      const addRemoveRow = buildAddRemoveButtons(currentWallet, 'userWallet', wallets.length > 0);
      const buttonRow = new ActionRowBuilder<ButtonBuilder>();
      const customizeDaruma = customButton(discordUserId, 'Customize your Daruma');
      if (totalUserAssets > 0) {
        buttonRow.addComponents(customizeDaruma);
      }
      if (optInButtons.length > 0) {
        buttonRow.addComponents(optInButtons);
      }
      const components = [addRemoveRow];
      if (buttonRow.components.length > 0) {
        components.push(buttonRow);
      }
      embedsObject.push({
        embeds: [embed],
        components,
      });
    }
    if (wallets.length <= 1) {
      const defaultEmbed = new EmbedBuilder().setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
      });
      if (wallets.length === 0) {
        const noWalletsEmbed = {
          embeds: [
            defaultEmbed
              .setTitle('No Wallets')
              .setDescription('Add a wallet by hitting the plus sign below!'),
          ],
          components: [buildAddRemoveButtons('newOnly', 'userWallet', false)],
        };
        await InteractionUtils.replyOrFollowUp(interaction, noWalletsEmbed);
        return;
      }
    }
    const pagination = new Pagination(
      interaction,
      embedsObject.map((embed) => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null);
        },
        // 30 Seconds in ms
        time: 30_000,
      },
    );
    await pagination.send();
  }
  private async getWalletEmbed({
    currentWallet,
    user,
  }: {
    currentWallet: WalletAddress;
    user: DiscordUser;
  }): Promise<{
    embed: EmbedBuilder;
    optInButtons: ButtonBuilder[];
  }> {
    const randomThumbnail = await this.algoNFTAssetService.getRandomImageURLByWallet(currentWallet);
    const embed = new EmbedBuilder().setThumbnail(randomThumbnail).setAuthor({
      name: user.username,
      iconURL: user.displayAvatarURL({ forceStatic: false }),
    });

    const { fields: tokenFields, buttons: optInButtons } =
      await this.buildTokenFields(currentWallet);
    const nfDomain = await this.nfDomainsManager.getWalletDomainNamesFromWallet(currentWallet);
    let nfDomainString = '';
    // join the array of domains into a string and add currentWallet.address to the end
    nfDomainString =
      nfDomain.length > 0
        ? `${inlineCode(nfDomain.join(', '))} ${currentWallet}`
        : inlineCode(currentWallet);
    embed.addFields([
      {
        name: 'Wallet Address',
        value: nfDomainString,
        inline: false,
      },
      ...tokenFields,
    ]);

    return { embed, optInButtons };
  }
  private async buildTokenFields(
    currentWallet: WalletAddress,
  ): Promise<{ fields: APIEmbedField[]; buttons: ButtonBuilder[] }> {
    const walletTokens = await this.rewardsService.getAllRewardTokensByWallet(currentWallet);
    const stdAssets = await this.algoStdAssetService.getAllStdAssets();
    const tokenFields: APIEmbedField[] = [];
    const optInButtons: ButtonBuilder[] = [];
    for (const stdAsset of stdAssets) {
      const walletToken = walletTokens.find((token) => token.asaId === stdAsset._id);
      const currentToken = walletToken
        ? await this.algoRepo.getTokenOptInStatus(currentWallet, walletToken.asaId)
        : { optedIn: false, tokens: null };
      const claimedTokens = currentToken.tokens?.toLocaleString() ?? '0';
      const unclaimedtokens = walletToken?.temporaryTokens?.toLocaleString() ?? '0';
      const optedIn = currentToken.optedIn ? ':white_check_mark:' : ':x:';
      const tokenName = stdAsset.name ?? 'Unknown';
      if (!currentToken.optedIn) {
        optInButtons.push(this.optInButtonCreator(stdAsset._id, tokenName));
      }
      tokenFields.push({
        name: `${tokenName} (${stdAsset._id})`,
        value: `Claimed: ${inlineCode(claimedTokens)} \nUnclaimed: ${inlineCode(
          unclaimedtokens,
        )} \nOpted In: ${optedIn}`,
      });
    }
    return { fields: tokenFields, buttons: optInButtons };
  }
  private optInButtonCreator(assetId: number, assetName: string): ButtonBuilder {
    return new ButtonBuilder()
      .setLabel(`Opt In -- ${assetName}`)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://algoxnft.com/asset/${assetId}`);
  }

  @ButtonComponent({ id: /((custom-button_)\S*)\b/gm })
  async customizedDaruma(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await paginatedDarumaEmbed(interaction);
  }

  @ButtonComponent({ id: /((daruma-edit-alias_)\S*)\b/gm })
  async editDarumaBtn(interaction: ButtonInteraction): Promise<void> {
    // Create the modal
    const assetId = interaction.customId.split('_')[1];
    const asset = await this.algoNFTAssetService.getAssetById(Number(assetId));
    if (!asset) {
      throw new Error('No asset found');
    }
    const modal = new ModalBuilder()
      .setTitle(`Customize your Daruma`)
      .setCustomId(`daruma-edit-alias-modal_${assetId}`);
    // Create text input fields
    const newAlias = new TextInputBuilder()
      .setCustomId(`new-alias`)
      .setLabel(`Custom Daruma Name`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(asset.name);
    if (asset.alias) {
      newAlias.setValue(asset.alias);
    }
    const newBattleCry = new TextInputBuilder()
      .setCustomId(`new-battle-cry`)
      .setLabel(`Your Flex Battle Cry (optional)`)
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(false);
    if (asset.battleCry) {
      newBattleCry.setValue(asset.battleCry);
    }
    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newAlias);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(newBattleCry);

    // Add action rows to form
    modal.addComponents(row1, row2);
    // Present the modal to the user
    await interaction.showModal(modal);
  }
  @ModalComponent({ id: /((daruma-edit-alias-modal_)\S*)\b/gm })
  async editDarumaModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const newAlias = interaction.fields.getTextInputValue('new-alias');
    const newBattleCry = interaction.fields.getTextInputValue('new-battle-cry');
    const assetId = interaction.customId.split('_')[1];
    const updatedAsset = await this.algoNFTAssetService.updateAliasOrBattleCry(
      Number(assetId),
      newAlias,
      newBattleCry,
    );
    if (!updatedAsset) {
      await interaction.editReply('No asset found');
      return;
    }
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `We have updated Daruma ${updatedAsset.name}\nAlias: ${newAlias}\n BattleCry: ${newBattleCry}`,
    );
    return;
  }
}
