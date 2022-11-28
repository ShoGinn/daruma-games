import {
  ButtonComponent,
  Discord,
  Guard,
  Slash,
  SlashGroup,
  SlashOption,
} from '@decorators'
import { Category, PermissionGuard } from '@discordx/utilities'
import { AlgoStdAsset, AlgoTxn, User } from '@entities'
import { Algorand, Database, Logger } from '@services'
import { ellipseAddress, resolveUser, yesNoButtons } from '@utils/functions'
import {
  ApplicationCommandOptionType,
  ButtonInteraction,
  CommandInteraction,
  GuildMember,
} from 'discord.js'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@Category('Karma')
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
export default class KarmaCommand {
  constructor(
    private algorand: Algorand,
    private db: Database,
    private logger: Logger
  ) {}
  @Guard(PermissionGuard(['Administrator']))
  @Slash({
    name: 'add',
    //localizationSource: 'COMMANDS.CLAIM',
  })
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
  ) {
    const discordUser = username?.id ?? ' '
    const user = await this.db.get(User).getUserById(discordUser)
    await this.db.get(User).addKarma(discordUser, amount)
    await interaction.followUp(
      `Added ${amount.toLocaleString()} KARMA to ${username} -- Now has ${user.karma.toLocaleString()} KARMA`
    )
  }

  @Slash({
    name: 'claim',
    localizationSource: 'COMMANDS.CLAIM',
  })
  @SlashGroup('karma')
  async claim(interaction: CommandInteraction) {
    const discordUser = resolveUser(interaction)?.id ?? ' '
    const user = await this.db.get(User).getUserById(discordUser)
    const rxWallet = await this.db.get(User).getRXWallet(discordUser)
    if (!rxWallet) {
      await interaction.followUp(
        'You do not have a wallet validated that can receive KARMA\n Add a wallet with `/wallet add` that is OPTED IN to the KARMA token\n Check your wallet with `/wallet list`'
      )
      return
    }
    if (user.karma == 0) {
      await interaction.followUp(`You don't have any KARMA to claim!`)
      return
    }
    let buttonRow = yesNoButtons('claim')
    await interaction.followUp({
      components: [buttonRow],
      content: `__**Are you sure you want to claim ${user.karma.toLocaleString()} KARMA?**__\n _This will be sent to your designated wallet:_\n ${ellipseAddress(
        rxWallet?.walletAddress
      )}`,
    })
    setTimeout(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      inx => inx.deleteReply(),

      30 * 1000,
      interaction
    )
  }
  @ButtonComponent({ id: 'simple-yes_claim' })
  @ButtonComponent({ id: 'simple-no_claim' })
  async simpleYesNo(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true })
    const discordUser = resolveUser(interaction)?.id ?? ' '
    const user = await this.db.get(User).getUserById(discordUser)
    const rxWallet = await this.db.get(User).getRXWallet(discordUser)
    if (rxWallet) {
      let karmaAsset
      try {
        karmaAsset = await this.db
          .get(AlgoStdAsset)
          .getStdAssetByUnitName('KRMA')
      } catch (_e) {
        console.log('Error getting KRMA Asset')
        await interaction.editReply(
          'Whoops tell the bot owner that the KRMA asset is not in the database'
        )
        return
      }
      let msg = ''
      let txnDetails
      switch (interaction.customId) {
        case 'simple-yes_claim':
          await this.logger.log(
            `Claiming ${user.karma} KARMA for ${discordUser}`
          )
          txnDetails = await this.algorand.claimToken(
            user.karma,
            rxWallet.walletAddress,
            karmaAsset.assetIndex,
            karmaAsset.tokenMnemonic
          )

          if (txnDetails?.txId) {
            msg = 'Transaction Successful\n'
            msg += `Txn ID: ${txnDetails.txId}\n`
            msg += `Txn Hash: ${txnDetails.status?.['confirmed-round']}\n`
            msg += `Transaction Amount: ${txnDetails?.status?.txn.txn.aamt}\n`
            msg += 'https://algoexplorer.io/tx/' + txnDetails?.txId

            user.karma = 0
            await this.db.get(AlgoTxn).addTxn(discordUser, 'claim', txnDetails)
            await this.db.get(User).flush()
          }
          await interaction.editReply(msg)
          break
        case 'simple-no_claim':
          await interaction.editReply(
            'No problem! Come back when you are ready!'
          )
          break
      }
    } else {
      await interaction.editReply(
        'You need to have a wallet designated to receive to claim your KARMA!'
      )
    }
  }
}
