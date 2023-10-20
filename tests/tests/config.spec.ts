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
  test('should return the configuration because its test mode!', () => {
    // Arrange

    // Act
    const result = getConfig();

    // Assert
    expect(result).toBeDefined();
    expect(logger.verbose).toHaveBeenCalledTimes(1);
  });
  test('should return a validated configuration', () => {
    // Arrange
    const validConfig = {
      nodeEnv: 'development',
      discordToken: 'test',
      botOwnerID: 'test',
      adminChannelId: 'test',
      clawbackTokenMnemonic: generateMnemonic(),
      transactionWebhook: generateFakeWebhookUrl(),
    };
    getConfig().load(validConfig);
    // Act
    // load up the mandatory configs
    const result = getConfig(false);

    // Assert
    expect(result).toBeDefined();
    expect(logger.verbose).toHaveBeenCalledTimes(2);
  });
});
