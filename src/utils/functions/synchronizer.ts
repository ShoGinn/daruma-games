import { User as DUser } from 'discord.js';

import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { User } from '../../entities/user.entity.js';
import { user as MongoUser } from '../../entities/user.mongo.js';

import logger from './logger-factory.js';

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

export async function syncUserMongo(user: DUser): Promise<void> {
  const userData = await MongoUser.findOne({
    _id: user.id,
  });

  if (userData) {
    return;
  }
  // add user to the db
  const newUser = new MongoUser({ _id: user.id });
  await newUser.save();

  logger.info(`New user added to the database: ${user.tag} (${user.id})`);
  return;
}
