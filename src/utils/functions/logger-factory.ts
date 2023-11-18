import { createLogger, format, Logger, transports } from 'winston';

export function createLoggerFactory(
  loggerName: string = '',
  handleExceptions: boolean = false,
  node_environment?: string,
): Logger {
  const loggerEnvironment = node_environment || process.env['NODE_ENV'];
  const isTestEnvironment = loggerEnvironment === 'test';
  const production = loggerEnvironment === 'production';
  /* istanbul ignore next */
  let logFormat = format.printf(({ level, message, timestamp, logger, ...metadata }) => {
    let message_ = `⚡ ${timestamp} ${logger ? `[${logger}] ` : ''}[${level}] : ${message} `;
    if (metadata && Object.keys(metadata).length > 0) {
      message_ += JSON.stringify(metadata);
    }
    return message_;
  });
  let logLevel = 'debug';
  if (loggerName === 'DiscordX') {
    logFormat = format.simple();
  }
  if (loggerName === 'GlobalEmitter') {
    logLevel = production ? 'none' : 'debug';
  }
  const transport = new transports.Console({
    level: logLevel,
    handleExceptions,
    format: format.combine(format.colorize(), format.splat(), format.timestamp(), logFormat),
  });

  return createLogger({
    level: logLevel,
    silent: isTestEnvironment,
    transports: [transport],
    exitOnError: false,
    defaultMeta: { logger: loggerName },
  });
}

// Exported loggers
export const globalEmitterLogger = createLoggerFactory('GlobalEmitter');

export const discordXLogger = createLoggerFactory('DiscordX');

export default createLoggerFactory('', true);
