import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

import logger from '../../../utils/functions/logger-factory.js';

export function withCustomDiscordApiErrorLogger(
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
): PropertyDescriptor {
    const originalMethod = descriptor.value;
    descriptor.value = function (...originalArguments: unknown[]) {
        try {
            return originalMethod.apply(this, originalArguments);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                if (
                    error.code === RESTJSONErrorCodes.UnknownInteraction ||
                    error.code === RESTJSONErrorCodes.UnknownMessage
                ) {
                    logger.debug('Unknown Interaction or Message');
                } else {
                    // if the error is DiscordAPIError[10062]: Unknown interaction skip it otherwise log it
                    logger.error(error);
                }
            }
        }
    };
    return descriptor;
}
