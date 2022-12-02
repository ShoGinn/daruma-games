import { Discord, Guard, Slash, SlashGroup, SlashOption } from '@decorators'
import {
  Category,
  PermissionGuard,
  RateLimit,
  TIME_UNIT,
} from '@discordx/utilities'
import { AlgoStdAsset, AlgoTxn, User } from '@entities'
import { Disabled } from '@guards'
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
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
export default class KarmaCommand {
  constructor(
    private algorand: Algorand,
    private db: Database,
    private logger: Logger
  ) { }
  @Guard(PermissionGuard(['Administrator']))
  @Guard(Disabled)
  @Slash({
    name: 'add',
    //localizationSource: 'COMMANDS.CLAIM',
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
  ) {
    const discordUser = username?.id ?? ' '
    const user = await this.db.get(User).getUserById(discordUser)
    await this.db.get(User).addKarma(discordUser, amount)
    await interaction.followUp(
      `Added ${amount.toLocaleString()} KARMA to ${username} -- Now has ${user.karma.toLocaleString()} KARMA`
    )
  }
  @Category('Karma')
  @Slash({
    name: 'claim',
    localizationSource: 'COMMANDS.CLAIM',
  })
  @SlashGroup('karma')
  @Guard(RateLimit(TIME_UNIT.minutes, 2))
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
    let karmaAsset: AlgoStdAsset
    try {
      karmaAsset = await this.db.get(AlgoStdAsset).getStdAssetByUnitName('KRMA')
    } catch (_e) {
      console.log('Error getting KRMA Asset')
      await interaction.editReply(
        'Whoops tell the bot owner that the KRMA asset is not in the database'
      )
      return
    }
    if (karmaAsset) {
      let buttonRow = yesNoButtons('claim')
      const message = await interaction.followUp({
        components: [buttonRow],
        content: `__**Are you sure you want to claim ${user.karma.toLocaleString()} KARMA?**__\n _This will be sent to your designated wallet:_\n ${ellipseAddress(
          rxWallet?.walletAddress
        )}`,
      })
      let msg = 'There was an error claiming your KARMA'
      let txnDetails

      const collector = message.createMessageComponentCollector()
      collector.on('collect', async (collectInteraction: ButtonInteraction) => {
        await collectInteraction.deferUpdate()
        await collectInteraction.editReply({ components: [] })

        if (collectInteraction.customId.includes('yes')) {
          await this.db.get(AlgoTxn).addPendingTxn(discordUser, user.karma)
          txnDetails = await this.algorand.claimToken(
            user.karma,
            rxWallet.walletAddress,
            karmaAsset.assetIndex,
            karmaAsset.tokenMnemonic
          )
          // Clear users Karma
          user.karma = 0
          await this.db.get(User).flush()
          if (txnDetails?.txId) {
            await this.logger.log(
              `Claimed ${user.karma} KARMA for ${discordUser} -- ${collectInteraction.user.username}`
            )
            msg = 'Transaction Successful\n'
            msg += `Txn ID: ${txnDetails.txId}\n`
            msg += `Txn Hash: ${txnDetails.status?.['confirmed-round']}\n`
            msg += `Transaction Amount: ${txnDetails?.status?.txn.txn.aamt}\n`
            msg += 'https://algoexplorer.io/tx/' + txnDetails?.txId

            await this.db.get(AlgoTxn).addTxn(discordUser, 'claim', txnDetails)
          }
          await collectInteraction.editReply(msg)
        }
        if (collectInteraction.customId.includes('no')) {
          await collectInteraction.editReply(
            'No problem! Come back when you are ready!'
          )
        }
        collector.stop()
      })
    }
  }
}
