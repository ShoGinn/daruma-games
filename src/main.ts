import 'reflect-metadata';
import { dirname, importx } from '@discordx/importer';
import { NotBot } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import { IntentsBitField } from 'discord.js';
import {
    Client,
    ClientOptions,
    DIService,
    ILogger,
    tsyringeDependencyRegistryEngine,
} from 'discordx';
import dotenv from 'dotenv';
import v8 from 'node:v8';
import { container } from 'tsyringe';

import { Maintenance } from './guards/Maintenance.js';
import { RequestContextIsolator } from './guards/requestContextIsolator.js';
import { Property } from './model/framework/decorators/Property.js';
import { Typeings } from './model/Typeings.js';
import initializeMikroOrm from './services/Database.js';
import { initDataTable } from './utils/functions/database.js';
import logger from './utils/functions/LoggerFactory.js';
import { ObjectUtil } from './utils/Utils.js';

dotenv.config();

ObjectUtil.verifyMandatoryEnvs();

export class Main {
    @Property('BOT_TOKEN')
    private static readonly token: string;

    @Property('NODE_ENV')
    private static readonly envMode: Typeings.propTypes['NODE_ENV'];

    @Property('TEST_TOKEN', Main.envMode === 'development')
    private static readonly testToken: string;

    /**
     * Start the bot
     *
     * @static
     * @returns {*}  {Promise<void>}
     * @memberof Main
     */
    public static async start(): Promise<void> {
        DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
        logger.info(`Process Arguments: ${process.execArgv}`);
        logger.info(`max heap space: ${v8.getHeapStatistics().total_available_size / 1024 / 1024}`);
        const testMode = Main.envMode === 'development';
        if (testMode) {
            logger.warn('Test Mode is enabled');
        }
        container.register(MikroORM, { useValue: await initializeMikroOrm() });
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
            guards: [RequestContextIsolator, Maintenance, NotBot],
            logger: new (class djxLogger implements ILogger {
                public error(...args: unknown[]): void {
                    logger.error(args);
                }

                public info(...args: unknown[]): void {
                    logger.info(args);
                }

                public log(...args: unknown[]): void {
                    logger.info(args);
                }

                public warn(...args: unknown[]): void {
                    logger.warn(args);
                }
            })(),
            silent: this.envMode !== 'development',
        };
        if (this.envMode === 'development') {
            clientOps.botGuilds = [
                (client: Client): string[] => client.guilds.cache.map(guild => guild.id),
            ];
        }
        logger.info(`Starting in ${this.envMode} mode`);
        const client = new Client(clientOps);
        if (!container.isRegistered(Client)) {
            container.registerInstance(Client, client);
        }
        await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);
        await client.login(testMode ? this.testToken : this.token);
    }
}

await Main.start();
