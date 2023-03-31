import { DiscordAPIError, RESTJSONErrorCodes as DiscordApiErrors } from 'discord.js';

import logger from '../../../utils/functions/logger-factory.js';
const IGNORED_ERRORS = new Set([
    DiscordApiErrors.UnknownMessage,
    DiscordApiErrors.UnknownChannel,
    DiscordApiErrors.UnknownGuild,
    DiscordApiErrors.UnknownMember,
    DiscordApiErrors.UnknownUser,
    DiscordApiErrors.UnknownInteraction,
    DiscordApiErrors.MissingAccess,
]);
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
            if (
                error instanceof DiscordAPIError &&
                typeof error.code == 'number' &&
                IGNORED_ERRORS.has(error.code)
            ) {
                logger.debug('Unknown Interaction or Message');
            } else {
                // if the error is DiscordAPIError[10062]: Unknown interaction skip it otherwise log it
                logger.error(error);
            }
        }
    };
    return descriptor;
}
