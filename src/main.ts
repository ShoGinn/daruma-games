import 'reflect-metadata';

import v8 from 'node:v8';

import { IntentsBitField } from 'discord.js';

import { dirname, importx } from '@discordx/importer';
import { NotBot } from '@discordx/utilities';
import {
  Client,
  ClientOptions,
  DIService,
  ILogger,
  tsyringeDependencyRegistryEngine,
} from 'discordx';

import { container } from 'tsyringe';

import { getConfig } from './config/config.js';
import { mongooseConnect } from './database/mongoose.js';
// import { GlobalEmitter } from './emitters/global-emitter.js';
import { Maintenance } from './guards/maintenance.js';
import logger, { discordXLogger } from './utils/functions/logger-factory.js';

const botConfig = getConfig();
export class Main {
  /**
   * Start the bot
   *
   * @static
   * @returns {*}  {Promise<void>}
   * @memberof Main
   */
  public static async start(): Promise<void> {
    DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
    logger.info(`Process Arguments: ${process.execArgv.toString()}`);
    logger.info(`max heap space: ${v8.getHeapStatistics().total_available_size / 1024 / 1024}`);
    logger.info(`Starting in ${botConfig.get('nodeEnv').toString() || 'unk'} mode`);
    const development = botConfig.get('nodeEnv') === 'development';
    if (development) {
      logger.warn('Development Mode is enabled');
    }
    // Connect to the databases
    await mongooseConnect();
    const clientOps: ClientOptions = {
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildPresences,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.MessageContent,
      ],
      guards: [Maintenance, NotBot],
      logger: new (class DiscordJSXLogger implements ILogger {
        public error(...arguments_: unknown[]): void {
          discordXLogger.error(arguments_);
        }

        public info(...arguments_: unknown[]): void {
          discordXLogger.info(arguments_);
        }

        public log(...arguments_: unknown[]): void {
          discordXLogger.info(arguments_);
        }

        public warn(...arguments_: unknown[]): void {
          discordXLogger.warn(arguments_);
        }
      })(),
      silent: !development,
    };
    if (development) {
      clientOps.botGuilds = [
        (client: Client): string[] => client.guilds.cache.map((guild) => guild.id),
      ];
    }
    const client = new Client(clientOps);
    if (!container.isRegistered(Client)) {
      container.registerInstance(Client, client);
    }
    await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);
    await client.login(botConfig.get('discordToken'));
  }
}

await Main.start();
