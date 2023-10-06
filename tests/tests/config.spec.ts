// Arrange

import { getConfig } from '../../src/config/config.js';
import logger from '../../src/utils/functions/logger-factory.js';
import { generateFakeWebhookUrl, generateMnemonic } from '../utils/test-funcs.js';

// Mock the logger
jest.mock('../../src/utils/functions/logger-factory.js', () => ({
  verbose: jest.fn(),
}));

// Assert
describe('getConfig', () => {
  it('should return the configuration because its test mode!', () => {
    // Arrange

    // Act
    const result = getConfig();

    // Assert
    expect(result).toBeDefined();
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });
  it('should return a validated configuration', () => {
    // Arrange
    getConfig().set('nodeEnv', 'development');
    getConfig().set('discordToken', 'test');
    getConfig().set('botOwnerID', 'test');
    getConfig().set('adminChannelId', 'test');
    getConfig().set('clawbackTokenMnemonic', generateMnemonic());
    getConfig().set('transactionWebhook', generateFakeWebhookUrl());
    // Act
    // load up the mandatory configs
    const result = getConfig(false);

    // Assert
    expect(result).toBeDefined();
    expect(logger.verbose).toHaveBeenCalledTimes(2);
  });
});
