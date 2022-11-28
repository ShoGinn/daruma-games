import { Discord, On } from '@decorators'
import {
  botCustomEvents,
  createNPCs,
  isCreatorAssetsSynced,
  isUserAssetsSynced,
  resolveDependency,
} from '@utils/functions'
import { Client } from 'discordx'
import { injectable } from 'tsyringe'

@Discord()
@injectable()
export default class BotExtraEvent {
  // =============================
  // ========= Handlers ==========
  // =============================

  @On(botCustomEvents.botLoaded)
  async botLoadedHandler() {
    let client = await resolveDependency(Client)
    await Promise.all([
      isCreatorAssetsSynced(),
      isUserAssetsSynced(),
      createNPCs(),
      client.emit(botCustomEvents.startWaitingRooms, client),
    ])
  }
}
