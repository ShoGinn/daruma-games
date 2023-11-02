import { MikroORM } from '@mikro-orm/core';
import { User as DUser } from 'discord.js';
import { container } from 'tsyringe';

import logger from './logger-factory.js';
import { User } from '../../entities/user.entity.js';
/**
 * Add a active user to the database if doesn't exist.
 *
 * @param {DUser} user
 * @returns {*}  {Promise<void>}
 */
export async function syncUser(user: DUser): Promise<void> {
  const database = container.resolve(MikroORM).em.fork();
  const userRepo = database.getRepository(User);

  const userData = await userRepo.findOne({
    id: user.id,
  });

  if (userData) {
    return;
  }
  // add user to the db
  const newUser = new User(user.id);
  await database.persistAndFlush(newUser);

  logger.info(`New user added to the database: ${user.tag} (${user.id})`);
  return;
}
