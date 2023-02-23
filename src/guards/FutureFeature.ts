import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../model/framework/manager/PropertyResolutionManager.js';
import { InteractionUtils } from '../utils/Utils.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

export function FutureFeature(
    arg: CommandInteraction,
    client: Client,
    next: Next
): Promise<unknown> {
    const userId = arg?.user?.id;
    const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;
    if (userId !== botOwnerId) {
        return InteractionUtils.replyOrFollowUp(arg, {
            ephemeral: true,
            content: 'This feature is not yet implemented!\nCommand aborted',
        });
    }
    return next();
}
