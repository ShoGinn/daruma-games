// Arrange
import { getConfig } from '../../../src/config/config.js';
import logger from '../../../src/utils/functions/logger-factory.js';
import { generateFakeWebhookUrl, generateMnemonic } from '../../setup/test-funcs.js';

// Assert
describe('getConfig', () => {
  let loggerVerboseSpy: jest.SpyInstance<void, [unknown]>;
  beforeEach(() => {
    // Create a spy for the logger function
    loggerVerboseSpy = jest.spyOn(logger, 'verbose') as jest.SpyInstance;
  });

  afterEach(() => {
    // Clear the logger spy after each test
    loggerVerboseSpy.mockClear();
  });

  test('should return the configuration because its test mode!', () => {
    // Arrange

    // Act
    const result = getConfig();

    // Assert
    expect(result).toBeDefined();
    expect(loggerVerboseSpy).toHaveBeenCalledTimes(1);
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
    expect(loggerVerboseSpy).toHaveBeenCalledTimes(1);
  });
});
