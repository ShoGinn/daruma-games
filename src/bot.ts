import { IntentsBitField } from 'discord.js';

import { NotBot } from '@discordx/utilities';
import { Client, ClientOptions, ILogger } from 'discordx';

import { container } from 'tsyringe';

import { getConfig } from './config/config.js';
import { Maintenance } from './guards/maintenance.js';
import { discordXLogger } from './utils/functions/logger-factory.js';

const development = getConfig().get('nodeEnv') === 'development';
const clientOps: ClientOptions = {
  botGuilds: [(client: Client): string[] => client.guilds.cache.map((guild) => guild.id)],
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

export const bot = new Client(clientOps);
if (!container.isRegistered(Client)) {
  container.registerInstance(Client, bot);
}
