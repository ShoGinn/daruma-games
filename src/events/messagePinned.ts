import { Discord, On } from '@decorators'
import { Message } from 'discord.js'
import { Client } from 'discordx'

@Discord()
export default class messagePinnedEvent {
  @On('messagePinned')
  messagePinnedHandler([message]: [Message], _client: Client) {
    console.log(
      `This message from ${message.author.tag} has been pinned : ${message.content}`
    )
  }
}
