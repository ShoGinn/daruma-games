import { CommandInteraction } from 'discord.js';
import { Client, Next } from 'discordx';
import { container } from 'tsyringe';

import { PropertyResolutionManager } from '../model/framework/manager/property-resolution-manager.js';
import { InteractionUtils } from '../utils/utils.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

export function FutureFeature(
    argument: CommandInteraction,
    client: Client,
    next: Next
): Promise<unknown> {
    const userId = argument?.user?.id;
    const botOwnerId = propertyResolutionManager.getProperty('BOT_OWNER_ID') as string;
    if (userId !== botOwnerId) {
        return InteractionUtils.replyOrFollowUp(argument, {
            ephemeral: true,
            content: 'This feature is not yet implemented!\nCommand aborted',
        });
    }
    return next();
}
