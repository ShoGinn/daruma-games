import { generalConfig } from '@config'
import { Discord, Guard, On } from '@decorators'
import { Maintenance } from '@guards'
import { executeEvalFromMessage, isDev } from '@utils/functions'
import { Events } from 'discord.js'
import { ArgsOf, Client } from 'discordx'

@Discord()
export default class MessageCreateEvent {
  @On(Events.MessageCreate)
  @Guard(Maintenance)
  async messageCreateHandler(
    [message]: ArgsOf<Events.MessageCreate>,
    client: Client
  ) {
    // eval command
    if (
      message.content.startsWith(`\`\`\`${generalConfig.eval.name}`) &&
      ((!generalConfig.eval.onlyOwner && isDev(message.author.id)) ||
        (generalConfig.eval.onlyOwner &&
          message.author.id === generalConfig.ownerId))
    ) {
      await executeEvalFromMessage(message)
    }

    await client.executeCommand(message, { caseSensitive: false })
  }
}
