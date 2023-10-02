import 'reflect-metadata';
import { dirname, importx } from '@discordx/importer';
import { NotBot } from '@discordx/utilities';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { MikroORM } from '@mikro-orm/core';
import { IntentsBitField } from 'discord.js';
import {
    Client,
    ClientOptions,
    DIService,
    ILogger,
    tsyringeDependencyRegistryEngine,
} from 'discordx';
import v8 from 'node:v8';
import { container } from 'tsyringe';

import { getConfig } from './config/config.js';
import { Maintenance } from './guards/maintenance.js';
import config from './mikro-orm.config.js';
import { initDataTable } from './services/data-repo.js';
import logger from './utils/functions/logger-factory.js';

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
        const testMode = botConfig.get('nodeEnv') === 'development';
        if (testMode) {
            logger.warn('Test Mode is enabled');
        }
        container.register(MikroORM, { useValue: await MikroORM.init<BetterSqliteDriver>(config) });
        // init the data table if it doesn't exist
        await initDataTable();

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
            logger: new (class djxLogger implements ILogger {
                public error(...arguments_: unknown[]): void {
                    logger.error(arguments_);
                }

                public info(...arguments_: unknown[]): void {
                    logger.info(arguments_);
                }

                public log(...arguments_: unknown[]): void {
                    logger.info(arguments_);
                }

                public warn(...arguments_: unknown[]): void {
                    logger.warn(arguments_);
                }
            })(),
            silent: !testMode,
        };
        if (testMode) {
            clientOps.botGuilds = [
                (client: Client): Array<string> => client.guilds.cache.map(guild => guild.id),
            ];
        }
        logger.info(`Starting in ${botConfig.get('nodeEnv').toString() || 'unk'} mode`);
        const client = new Client(clientOps);
        if (!container.isRegistered(Client)) {
            container.registerInstance(Client, client);
        }
        await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);
        await client.login(botConfig.get('discordToken'));
    }
}

await Main.start();
