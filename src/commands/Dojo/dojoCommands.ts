import { Discord, Slash, SlashGroup, SlashOption } from '@decorators'
import {
  Category,
  EnumChoice,
  PermissionGuard,
  RateLimit,
  TIME_UNIT,
} from '@discordx/utilities'
import { AlgoNFTAsset, DarumaTrainingChannel } from '@entities'
import { Guard, Maintenance } from '@guards'
import { Database, Ranking } from '@services'
import {
  assetName,
  botCustomEvents,
  buildGameType,
  flexDaruma,
  GameTypes,
  getAssetUrl,
  karmaPayoutCalculator,
  msToHour,
  onlyDigits,
  paginatedDarumaEmbed,
  randomNumber,
  resolveDependency,
} from '@utils/functions'
import {
  ApplicationCommandOptionType,
  ButtonInteraction,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js'
import { ButtonComponent, Client, SlashChoice } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
  constructor(private db: Database) {}
  @Category('Admin')
  @Guard(PermissionGuard(['Administrator']))
  @Slash({
    name: 'join',
    description: 'Have the bot join a dojo channel!',
  })
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
  @Category('Dojo')
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
      const karmaPayoutNoZen = karmaPayoutCalculator(
        randomRound,
        gameSettings.token,
        false
      )
      const karmaPayoutZen = karmaPayoutCalculator(
        randomRound,
        gameSettings.token,
        true
      )
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
    name: 'daruma',
    description: 'Setup your Daruma Customization',
  })
  @Guard()
  @SlashGroup('dojo')
  async daruma(interaction: CommandInteraction) {
    await paginatedDarumaEmbed(interaction)
  }

  @Slash({
    name: 'ranking',
    description: 'Shows the top 20 ranking Daruma in the Dojos',
  })
  @Guard()
  @SlashGroup('dojo')
  async ranking(interaction: CommandInteraction) {
    let ranking = await resolveDependency(Ranking)

    const algoExplorerURL = 'https://www.nftexplorer.app/asset/'
    let winsRatio = await this.db
      .get(AlgoNFTAsset)
      .assetRankingsByWinLossRatio()
    // get the longest asset name length
    let winsRatioString = winsRatio
      .slice(0, 20)
      .map((asset, index) => {
        const thisAssetName = assetName(asset)
        const paddedIndex = (index + 1).toString().padStart(2, ' ')
        const wins = asset.assetNote?.dojoTraining?.wins.toString() ?? '0'
        const losses = asset.assetNote?.dojoTraining?.losses.toString() ?? '0'
        const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`
        const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${asset.assetIndex} "${urlTitle}")`
        return `\`${paddedIndex}.\` ${assetNameAndLink}`
      })
      .join('\n')
    let newEmbed = new EmbedBuilder()
    newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`)
    newEmbed.setDescription(winsRatioString)
    newEmbed.setThumbnail(getAssetUrl(winsRatio[0]))
    newEmbed.setFooter({
      text: `Based on wins/losses ratio.\nTotal Games Played ${ranking
        .get('totalGames')
        .toLocaleString()}\nStats updated every ~10 minutes`,
    })
    await interaction.followUp({ embeds: [newEmbed] })
  }
  @Guard(Maintenance)
  @Guard(RateLimit(TIME_UNIT.seconds, 20))
  @ButtonComponent({ id: /((daruma-flex)[^\s]*)\b/gm })
  async selectPlayer(interaction: ButtonInteraction) {
    await flexDaruma(interaction)
  }
}
