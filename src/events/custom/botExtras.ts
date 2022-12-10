import { Client, Discord, On } from 'discordx';
import { injectable } from 'tsyringe';

import { botCustomEvents } from '../../enums/dtEnums.js';
import {
    createNPCs,
    isCreatorAssetsSynced,
    isUserAssetsSynced,
} from '../../utils/functions/algoScheduleCheck.js';

@Discord()
@injectable()
export default class BotExtraEvent {
    // =============================
    // ========= Handlers ==========
    // =============================

    @On(botCustomEvents.botLoaded)
    async botLoadedHandler(client: Client): Promise<void> {
        await Promise.all([
            isCreatorAssetsSynced(),
            isUserAssetsSynced(),
            createNPCs(),
            client.emit(botCustomEvents.startWaitingRooms, client),
        ]);
    }
}
