import { ButtonComponent, Discord, ModalComponent, Slash } from '@decorators'
import { Pagination, PaginationType } from '@discordx/pagination'
import { Category, PermissionGuard } from '@discordx/utilities'
import { AlgoStdAsset, AlgoWallet } from '@entities'
import { Disabled, Guard } from '@guards'
import { Algorand, Database } from '@services'
import {
  addRemoveButtons,
  getAccountFromMnemonic,
  resolveDependencies,
} from '@utils/functions'
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@Category('Admin')
export default class SetupCommand {
  constructor(private algoRepo: Algorand, private db: Database) {}
  private buttonFunctionNames = {
    creatorWallet: 'creatorWalletButton',
    addStd: 'addStd',
  }
  @Guard(Disabled, PermissionGuard(['Administrator']))
  @Slash({ name: 'setup', description: 'Setup The Bot' })
  async setup(interaction: CommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('Setup')
      .setDescription('Use the buttons below to setup the bot')
    await interaction.followUp({
      embeds: [embed],
      components: [this.setupButtons()],
    })
    setTimeout(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      inx =>
        inx.editReply({
          embeds: [],
          components: [],
          content:
            'Timed-Out: Re-Run Setup Again if you need to configure more.',
        }),
      30 * 1000,
      interaction
    )
  }
  setupButtons = () => {
    const creatorWallet = new ButtonBuilder()
      .setCustomId(`creatorWallet`)
      .setLabel('Manage Creator Wallets')
      .setStyle(ButtonStyle.Primary)

    const stdAsset = new ButtonBuilder()
      .setCustomId(`stdAsset`)
      .setLabel('Manage Standard Assets')
      .setStyle(ButtonStyle.Primary)

    const buttonRow =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        creatorWallet,
        stdAsset
      )
    return buttonRow
  }
  @ButtonComponent({ id: 'creatorWallet' })
  async creatorWalletButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    const creatorWallets = await this.db.get(AlgoWallet).getCreatorWallets()
    let embedsObject: BaseMessageOptions[] = []
    creatorWallets.map((wallet, i) => {
      const embed = new EmbedBuilder().setTitle('Creator Wallets')
      embed.addFields({ name: `Wallet ${i + 1}`, value: wallet.walletAddress })
      let buttonRow = addRemoveButtons(
        wallet.walletAddress,
        this.buttonFunctionNames.creatorWallet,
        creatorWallets.length < 1
      )
      embedsObject.push({
        embeds: [embed],
        components: [buttonRow],
      })
    })
    if (creatorWallets.length <= 1) {
      const defaultEmbed = new EmbedBuilder().setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
      })
      if (creatorWallets.length === 0) {
        embedsObject.push({
          embeds: [
            defaultEmbed
              .setTitle('No Creator Wallets')
              .setDescription(
                'Add a creator wallet by hitting the plus sign below!'
              ),
          ],
          components: [
            addRemoveButtons(
              'newOnly',
              this.buttonFunctionNames.creatorWallet,
              true
            ),
          ],
        })
        await interaction.editReply(embedsObject[0])
        return
      }
    }

    const pagination = new Pagination(
      interaction,
      embedsObject.map(embed => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null)
        },
        // 30 Seconds in ms
        time: 30 * 1000,
      }
    )
    await pagination.send()
  }

  @ButtonComponent({ id: /((simple-add-creatorWalletButton_)[^\s]*)\b/gm })
  async addWallet(interaction: ButtonInteraction) {
    // Create the modal
    const modal = new ModalBuilder()
      .setTitle('Add an Creators Algorand Wallet')
      .setCustomId('addCreatorWalletModal')
    // Create text input fields
    const newWallet = new TextInputBuilder()
      .setCustomId('new-wallet')
      .setLabel('Creator Wallet Address')
      .setStyle(TextInputStyle.Short)
    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      newWallet
    )
    // Add action rows to form
    modal.addComponents(row1)
    // Present the modal to the user
    await interaction.showModal(modal)
  }
  @ModalComponent()
  async addCreatorWalletModal(
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    const newWallet = interaction.fields.getTextInputValue('new-wallet')
    await interaction.deferReply({ ephemeral: true })
    if (!this.algoRepo.validateWalletAddress(newWallet)) {
      await interaction.editReply('Invalid Wallet Address')
      return
    }
    // Add Creator wallet to the database
    await interaction.editReply('Adding Creator Wallet.. this may take a while')
    const createdWallet = await this.db
      .get(AlgoWallet)
      .addCreatorWallet(newWallet)
    if (createdWallet) {
      await interaction.followUp(
        `Added Creator Wallet Address: ${newWallet} to the database`
      )
    } else {
      await interaction.followUp(
        `Creator Wallet Address: ${newWallet} already exists in the database`
      )
    }
    return
  }
  @ButtonComponent({ id: /((simple-remove-creatorWalletButton_)[^\s]*)\b/gm })
  async removeWallet(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    const address = interaction.customId.split('_')[1]
    await this.db.get(AlgoWallet).removeCreatorWallet(address)
    let msg = 'Removed wallet ' + address
    await interaction.editReply(msg)
  }

  //*!
  /* Std Asset */
  //*!
  @ButtonComponent({ id: 'stdAsset' })
  async stdAssetWalletButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    const stdAssets = await this.db.get(AlgoStdAsset).getAllStdAssets()
    let embedsObject: BaseMessageOptions[] = []
    stdAssets.map((asset, i) => {
      const embed = new EmbedBuilder().setTitle('Standard Assets')
      embed.addFields({
        name: `Asset ${i + 1} - ${asset.name}`,
        value: `${asset.unitName} -- Stored Mnemonic: ${
          asset.tokenMnemonic?.length > 0
        }`,
      })
      let buttonRow = addRemoveButtons(
        asset.assetIndex.toString(),
        this.buttonFunctionNames.addStd,
        stdAssets.length < 1
      )
      embedsObject.push({
        embeds: [embed],
        components: [buttonRow],
      })
    })
    if (stdAssets.length <= 1) {
      const defaultEmbed = new EmbedBuilder().setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
      })
      if (stdAssets.length === 0) {
        embedsObject.push({
          embeds: [
            defaultEmbed
              .setTitle('No standard assets')
              .setDescription(
                'Add a standard asset by hitting the plus sign below!'
              ),
          ],
          components: [
            addRemoveButtons('newOnly', this.buttonFunctionNames.addStd, true),
          ],
        })
        await interaction.editReply(embedsObject[0])
        return
      }
    }

    const pagination = new Pagination(
      interaction,
      embedsObject.map(embed => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null)
        },
        // 30 Seconds in ms
        time: 30 * 1000,
      }
    )
    await pagination.send()
  }

  @ButtonComponent({ id: /((simple-add-addStd_)[^\s]*)\b/gm })
  async addStdAsset(interaction: ButtonInteraction) {
    // Create the modal
    const modal = new ModalBuilder()
      .setTitle('Add an Standard Asset')
      .setCustomId('addStdAssetModal')
    // Create text input fields
    const newAsset = new TextInputBuilder()
      .setCustomId('new-asset')
      .setLabel('Asset ID')
      .setStyle(TextInputStyle.Short)
    const newAssetMnemonic = new TextInputBuilder()
      .setCustomId('new-asset-mnemonic')
      .setRequired(false)
      .setLabel('Asset Mnemonic')
      .setStyle(TextInputStyle.Short)

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      newAsset
    )
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      newAssetMnemonic
    )
    // Add action rows to form
    modal.addComponents(row1, row2)
    // Present the modal to the user
    await interaction.showModal(modal)
  }
  @ModalComponent()
  async addStdAssetModal(interaction: ModalSubmitInteraction): Promise<void> {
    const newAsset = Number(interaction.fields.getTextInputValue('new-asset'))
    const newAssetMnemonic =
      interaction.fields.getTextInputValue('new-asset-mnemonic')
    await interaction.deferReply({ ephemeral: true })

    const stdAssetExists = await this.db
      .get(AlgoStdAsset)
      .doesAssetExist(newAsset)
    if (stdAssetExists) {
      await interaction.followUp(
        `Standard Asset with ID: ${newAsset} already exists in the database`
      )
      return
    }
    await interaction.followUp(
      `Checking Wallet Address: ${newAsset} for ASA's...`
    )
    const stdAsset = await this.algoRepo.lookupAssetByIndex(newAsset)
    if (stdAsset.asset.deleted != false) {
      await interaction.editReply(
        `No ASA's found for Wallet Address: ${newAsset}`
      )
    } else {
      await interaction.editReply(
        `ASA's found for Wallet Address: ${newAsset}\n ${stdAsset.asset.params.name}`
      )
      await this.db.get(AlgoStdAsset).addAlgoStdAsset(stdAsset)
      if (newAssetMnemonic.length > 0) {
        try {
          const account = getAccountFromMnemonic(newAssetMnemonic)
          console.log(
            `Adding mnemonic for ${stdAsset.asset.params.name}, ${account.addr}`
          )
          await this.db
            .get(AlgoStdAsset)
            .addStdAssetMnemonic(newAsset, newAssetMnemonic)
        } catch (error) {
          console.log(error)
        }
      }
      const [algorand] = await resolveDependencies([Algorand])
      await algorand.userAssetSync()
    }
  }
  @ButtonComponent({ id: /((simple-remove-addStd_)[^\s]*)\b/gm })
  async removeStdAsset(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    const address = interaction.customId.split('_')[1]
    const stdAssetExists = await this.db
      .get(AlgoStdAsset)
      .doesAssetExist(Number(address))
    if (!stdAssetExists) {
      await interaction.followUp(
        `Standard Asset with ID: ${address} doesn't exists in the database`
      )
      return
    }
    await interaction.followUp(`Deleting Address: ${address} for ASA's...`)
    await this.db.get(AlgoStdAsset).deleteStdAsset(Number(address))
    const [algorand] = await resolveDependencies([Algorand])
    await algorand.userAssetSync()
    await interaction.editReply(`ASA's deleted for Wallet Address: ${address}`)
  }
}
