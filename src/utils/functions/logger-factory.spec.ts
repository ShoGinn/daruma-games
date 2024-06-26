import { Logger } from 'winston';

import * as loggerFactory from './logger-factory.js';

describe('Logger Factory', () => {
  it('should create a DiscordX logger', () => {
    const logger = loggerFactory.discordXLogger;
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.level).toBe('debug');
    expect(logger.defaultMeta).toEqual({ logger: 'DiscordX' });
  });

  it('should create a globalEmitterLogger', () => {
    expect(loggerFactory.globalEmitterLogger).toBeInstanceOf(Logger);
    expect(loggerFactory.globalEmitterLogger.level).toBe(
      process.env['NODE_ENV'] === 'production' ? 'none' : 'debug',
    );
    expect(loggerFactory.globalEmitterLogger.defaultMeta).toEqual({ logger: 'GlobalEmitter' });
  });
  it('should create a default logger with no logger name', () => {
    const logger = loggerFactory.createLoggerFactory();
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.level).toBe('debug');
    expect(logger.defaultMeta).toEqual({ logger: '' });
  });
  it('should create a global emitter with production node_env', () => {
    const logger = loggerFactory.createLoggerFactory('GlobalEmitter', false, 'production');
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.level).toBe('none');
    expect(logger.defaultMeta).toEqual({ logger: 'GlobalEmitter' });
  });
  it('should create a discordx logger with production node_env', () => {
    const logger = loggerFactory.createLoggerFactory('DiscordX', false, 'production');
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.level).toBe('debug');
    expect(logger.defaultMeta).toEqual({ logger: 'DiscordX' });
    logger.verbose('test');
  });
  it('should create the default logger', () => {
    expect(loggerFactory.default).toBeInstanceOf(Logger);
    expect(loggerFactory.default.level).toBe('debug');
    expect(loggerFactory.default.defaultMeta).toEqual({ logger: '' });
    expect(loggerFactory.default.transports).toHaveLength(1);
    expect(loggerFactory.default.transports[0]!.level).toBe('debug');
    expect(loggerFactory.default.transports[0]!.handleExceptions).toBe(true);
  });
  it('should create a JSON logger for railway', () => {
    const logger = loggerFactory.createLoggerFactory('Railway', false, 'production');
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.level).toBe('debug');
    logger.verbose('test');
  });
});
describe('getFormatAndLevel', () => {
  it('should return default format and level for unknown logger', () => {
    const { logFormat, logLevel } = loggerFactory.getFormatAndLevel('Unknown', false);
    expect(typeof logFormat).toBe('object');
    expect(logLevel).toBe('debug');
  });

  it('should return custom format for DiscordX logger', () => {
    const { logFormat, logLevel } = loggerFactory.getFormatAndLevel('DiscordX', false);
    expect(typeof logFormat).toBe('object');
    expect(logLevel).toBe('debug');
  });

  it('should return custom level for GlobalEmitter logger in production', () => {
    const { logFormat, logLevel } = loggerFactory.getFormatAndLevel('GlobalEmitter', true);
    expect(typeof logFormat).toBe('object');
    expect(logLevel).toBe('none');
  });

  it('should return default level for GlobalEmitter logger in development', () => {
    const { logFormat, logLevel } = loggerFactory.getFormatAndLevel('GlobalEmitter', false);
    expect(typeof logFormat).toBe('object');
    expect(logLevel).toBe('debug');
  });
});
