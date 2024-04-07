/* eslint-disable unicorn/prefer-top-level-await */
import 'reflect-metadata';

import v8 from 'node:v8';

import { dirname, importx } from '@discordx/importer';
import { DIService, tsyringeDependencyRegistryEngine } from 'discordx';

import { container } from 'tsyringe';

import { bot } from './bot.js';
import { getConfig } from './config/config.js';
import { mongooseConnect } from './database/mongoose.js';
import logger from './utils/functions/logger-factory.js';

const botConfig = getConfig();
async function run(): Promise<void> {
  DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
  logger.info(`Process Arguments: ${process.execArgv.toString()}`);
  logger.info(`max heap space: ${v8.getHeapStatistics().total_available_size / 1024 / 1024}`);
  logger.info(`Starting in ${botConfig.get('nodeEnv').toString() || 'unk'} mode`);
  // Connect to the databases
  await mongooseConnect();

  await importx(`${dirname(import.meta.url)}/{events,commands}/**/!(*.spec|*.service).{ts,js}`);
  await bot.login(botConfig.get('discordToken'));
}
run().catch((error: unknown) => {
  logger.error(error);
  throw error;
});
