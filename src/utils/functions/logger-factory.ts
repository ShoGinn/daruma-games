import { createLogger, format, Logger, transports } from 'winston';
import type * as Transport from 'winston-transport';

const { combine, splat, timestamp, colorize, printf } = format;
const nodeEnvironment = process.env?.['NODE_ENV'];
const isTestEnvironment = nodeEnvironment === 'test';

class JestFilterTransport extends transports.Console {
  public override log(info: unknown, callback: () => void): void {
    /* istanbul ignore next */
    if (!isTestEnvironment && super.log) {
      super.log(info, callback);
    } else {
      setImmediate(callback);
    }
  }
}

function createLoggerFactory(level: string, loggerName: string = '', logFormat?: unknown): Logger {
  const consoleTransport = createConsoleTransport(level, logFormat);
  const transportsArray = isTestEnvironment ? [createJestFilterTransport()] : [consoleTransport];

  return createLogger({
    level,
    transports: transportsArray,
    exitOnError: false,
    defaultMeta: { logger: loggerName },
  });
}
function createConsoleTransport(level: string, logFormat?: unknown): Transport {
  return new transports.Console({
    level,
    format: combine(colorize(), splat(), timestamp(), logFormat || createLogFormat()),
  });
}
function createJestFilterTransport(): Transport {
  return new JestFilterTransport({
    level: 'debug',
    format: combine(splat(), timestamp(), createLogFormat()),
    handleExceptions: true,
    handleRejections: true,
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLogFormat(): any {
  return printf(({ level, message, timestamp, logger, ...metadata }) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    let message_ = `⚡ ${timestamp} ${logger ? `[${logger}] ` : ''}[${level}] : ${message} `;
    if (metadata && Object.keys(metadata).length > 0) {
      message_ += JSON.stringify(metadata);
    }
    return message_;
  });
}
function createDiscordXLogger(): Logger {
  const simpleFormat = format.printf(({ message }) => message);
  const discordXLogger = createLoggerFactory('debug', 'DiscordX', simpleFormat);
  return discordXLogger;
} // Create a separate logger for GlobalEmitter
export const globalEmitterLogger = createLoggerFactory(
  nodeEnvironment === 'production' ? 'none' : 'debug',
  'GlobalEmitter',
);
export const discordXLogger = createDiscordXLogger();
const logger = createLoggerFactory('debug');

export default logger;
