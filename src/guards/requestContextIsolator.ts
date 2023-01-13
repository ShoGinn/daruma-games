import { MikroORM, RequestContext } from '@mikro-orm/core';
import type { GuardFunction } from 'discordx';
import { container } from 'tsyringe';

/**
 * Isolate all the handling pipeline to prevent any MikrORM global identity map issues
 */
export const RequestContextIsolator: GuardFunction = async (_, client, next) => {
    const db = container.resolve(MikroORM);
    RequestContext.create(db.em, next);
};
