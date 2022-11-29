import { Discord, Slash, SlashGroup, SlashOption } from '@decorators'
import { Category, EnumChoice, PermissionGuard } from '@discordx/utilities'
import { AlgoNFTAsset, DarumaTrainingChannel } from '@entities'
import { Guard } from '@guards'
import { Database } from '@services'
import {
  assetName,
  botCustomEvents,
  buildGameType,
  emojiConvert,
  GameTypes,
  karmaPayout,
  msToHour,
  onlyDigits,
  randomNumber,
  resolveDependency,
} from '@utils/functions'
import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js'
import { Client, SlashChoice } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@Category('Admin')
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
  constructor(private db: Database) {}

  @Guard(PermissionGuard(['Administrator']))
  @Slash({
    name: 'join',
    description: 'Have the bot join a dojo channel!',
  })
  @Guard()
  @SlashGroup('dojo')
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
  ) {
    let client = await resolveDependency(Client)
    // Remove all but digits from channel name
    const channelId = onlyDigits(channelName.toString())
    await this.db.get(DarumaTrainingChannel).addChannel(channelId, channelType)
    client.emit(botCustomEvents.startWaitingRooms, client)
    await interaction.followUp(
      `Joined ${channelName}, with the default settings!`
    )
  }
  @Slash({
    name: 'channel',
    description: 'Show the current channel settings',
  })
  @Guard()
  @SlashGroup('dojo')
  async settings(interaction: CommandInteraction) {
    // Get channel id from interaction
    const channelId = interaction.channelId
    // Get channel settings from database
    const channelSettings = await this.db
      .get(DarumaTrainingChannel)
      .getAllChannels()
    // Get channel settings for current channel
    const currentChannelSettings = channelSettings.find(
      channel => channel.channelId === channelId
    )
    // If no settings found, return
    if (!currentChannelSettings) {
      await interaction.followUp(`This channel is not currently being tracked!`)
      return
    }
    if (currentChannelSettings) {
      const gameSettings = buildGameType(currentChannelSettings)
      const randomRound = randomNumber(1, 25)
      const karmaPayoutNoZen = karmaPayout(randomRound, gameSettings, false)
      const karmaPayoutZen = karmaPayout(randomRound, gameSettings, true)
      let newEmbed = new EmbedBuilder()
      newEmbed.setTitle(`Channel Settings`)
      newEmbed.setDescription(`Current settings for this channel are:`)
      newEmbed.addFields(
        {
          name: `Game Type`,
          value: gameSettings.gameType,
          inline: true,
        },
        {
          name: 'Cooldown',
          value: msToHour(gameSettings.coolDown).toString() + ' hours',
          inline: true,
        },
        {
          name: `\u200b`,
          value: `\u200b`,
        },
        {
          name: 'KARMA Payouts',
          value: '\u200B',
        },
        {
          name: 'Base Payout',
          value: gameSettings.token.baseAmount.toString(),
          inline: true,
        },
        {
          name: 'Achieving Zen multiplies the payout by ',
          value: gameSettings.token.zenMultiplier.toString(),
          inline: true,
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true,
        },
        {
          name: 'Rounds 6+ Adds an additional',
          value: gameSettings.token.roundModifier.toString(),
          inline: true,
        },
        {
          name: 'Each round 6+ in Zen increases the multiplier by',
          value: gameSettings.token.zenRoundModifier.toString(),
          inline: true,
        },
        {
          name: '\u200B',
          value: 'Example Payouts',
        },
        {
          name: `Round ${randomRound} with Zen`,
          value: karmaPayoutZen.toString(),
          inline: true,
        },
        {
          name: `Round ${randomRound} without Zen`,
          value: karmaPayoutNoZen.toString(),
          inline: true,
        }
      )
      await interaction.followUp({ embeds: [newEmbed] })
    }
  }
  @Slash({
    name: 'ranking',
    description: 'Shows the current ranking for all Daruma Dojos',
  })
  @Guard()
  @SlashGroup('dojo')
  async ranking(interaction: CommandInteraction) {
    let mostWins = await this.db.get(AlgoNFTAsset).assetRankingsByWins()
    let winsRatio = await this.db
      .get(AlgoNFTAsset)
      .assetRankingsByWinLossRatio()
    // Turn the first 10 items in the array into a string
    let mostWinsString = mostWins
      .slice(0, 10)
      .map(
        (asset, index) =>
          `${index + 1}. ${assetName(asset)} with ${emojiConvert(
            asset.assetNote?.dojoTraining?.wins.toString() ?? '0'
          )} wins!`
      )
      .join('\n')
    let winsRatioString = winsRatio
      .slice(0, 10)
      .map(
        (asset, index) =>
          `${index + 1}. ${assetName(asset)} with ${emojiConvert(
            asset.assetNote?.dojoTraining?.wins.toString() ?? '0'
          )} wins and ${emojiConvert(
            asset.assetNote?.dojoTraining?.losses.toString() ?? '0'
          )} losses!`
      )
      .join('\n')

    let newEmbed = new EmbedBuilder()
    newEmbed.setTitle(`Daruma Dojo Ranking`)
    newEmbed.setDescription(`Current ranking for all Daruma Dojos`)
    newEmbed.addFields(
      {
        name: 'Ranked by Most Wins',
        value: mostWinsString,
        inline: true,
      },
      {
        name: 'Ranked by Winning Ratio',
        value: winsRatioString,
      }
    )
    await interaction.followUp({ embeds: [newEmbed] })
  }
}
