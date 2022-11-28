import { Discord, Guard, On } from '@decorators'
import { Guild, User } from '@entities'
import { Maintenance } from '@guards'
import { Database, Logger, Stats } from '@services'
import { syncUser } from '@utils/functions'
import { CommandInteraction, Events } from 'discord.js'
import { ArgsOf, Client } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
export default class InteractionCreateEvent {
  constructor(
    private stats: Stats,
    private logger: Logger,
    private db: Database
  ) {}

  @On(Events.InteractionCreate)
  @Guard(Maintenance)
  async interactionCreateHandler(
    [interaction]: ArgsOf<Events.InteractionCreate>,
    client: Client
  ) {
    // defer the reply
    if (interaction instanceof CommandInteraction)
      await interaction.deferReply({ ephemeral: true })

    // insert user in db if not exists
    await syncUser(interaction.user)

    // update last interaction time of both user and guild
    await this.db.get(User).updateLastInteract(interaction.user.id)
    await this.db.get(Guild).updateLastInteract(interaction.guild?.id)

    // register logs and stats
    await this.stats.registerInteraction(interaction as AllInteractions)
    await this.logger.logInteraction(interaction as AllInteractions)

    client.executeInteraction(interaction)
  }
}
