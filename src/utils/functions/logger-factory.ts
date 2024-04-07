/* istanbul ignore file */
import { createLogger, format, Logform, Logger, transports } from 'winston';

export function createLoggerFactory(
  loggerName: string = '',
  handleExceptions: boolean = false,
  node_environment: string = process.env['NODE_ENV'] ?? '',
  transport: transports.ConsoleTransportInstance = new transports.Console(),
): Logger {
  const isTestEnvironment = node_environment === 'test';
  const production = node_environment === 'production';

  const { logFormat, logLevel } = getFormatAndLevel(loggerName, production);

  transport.level = logLevel;
  transport.handleExceptions = handleExceptions;
  transport.format = production
    ? format.json()
    : format.combine(format.colorize(), format.splat(), format.timestamp(), logFormat);

  return createLogger({
    level: logLevel,
    silent: isTestEnvironment,
    transports: [transport],
    exitOnError: false,
    defaultMeta: { logger: loggerName },
  });
}

export function getFormatAndLevel(
  loggerName: string,
  production: boolean,
): { logFormat: Logform.Format; logLevel: string } {
  let logFormat = format.printf(({ level, message, timestamp, logger, ...metadata }) => {
    let message_ = `⚡ ${timestamp} ${logger ? `[${logger}] ` : ''}[${level}] : ${message} `;
    if (Object.keys(metadata).length > 0) {
      message_ += JSON.stringify(metadata);
    }
    return message_;
  });
  let logLevel = 'debug';

  if (loggerName === 'DiscordX') {
    logFormat = format.printf(({ message }) => {
      return message;
    });
  }
  if (loggerName === 'GlobalEmitter') {
    logLevel = production ? 'none' : 'debug';
  }

  return { logFormat, logLevel };
}
// Exported loggers
export const globalEmitterLogger = createLoggerFactory('GlobalEmitter');

export const discordXLogger = createLoggerFactory('DiscordX');

export default createLoggerFactory('', true);
