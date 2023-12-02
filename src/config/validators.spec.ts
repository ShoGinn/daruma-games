// Arrange
import { isValidAddress, seedFromMnemonic } from 'algosdk';
import convict from 'convict';

import { generateFakeWebhookUrl } from '../../tests/setup/test-funcs.js';

// Import the validators
import {
  mnemonicFormat,
  nonEmptyString,
  validAlgoAddressFormat,
  webhookUrlValidator,
} from './validators.js';

// Mock the seedFromMnemonic function
jest.mock('algosdk', () => ({
  isValidAddress: jest.fn(),
  seedFromMnemonic: jest.fn(),
  Indexer: jest.fn(),
}));
const seedFromMnemonicMock = seedFromMnemonic as jest.MockedFunction<typeof seedFromMnemonic>;
const isValidAddressMock = isValidAddress as jest.MockedFunction<typeof isValidAddress>;
// Act
// No specific act section is needed for the validators since they are just objects with validate functions.

// Assert
describe('validators', () => {
  let config:
    | convict.Config<{ mnemonic: string }>
    | convict.Config<{ algoAddress: string }>
    | convict.Config<{ webhookUrl: string }>
    | convict.Config<{ nonEmptyString: string }>;
  describe('add formatters to convict', () => {
    convict.addFormats({
      mnemonicFormat,
      validAlgoAddressFormat,
      webhookUrlValidator,
      nonEmptyString,
    });
  });
  describe('mnemonicFormat', () => {
    test('should validate a valid mnemonic', () => {
      // Arrange
      config = convict({
        mnemonic: {
          format: 'mnemonicFormat',
          default: 'valid mnemonic',
        },
      });

      // Act
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).not.toThrow();
    });
  });
  test('should throw an error for an invalid mnemonic', () => {
    // Arrange
    seedFromMnemonicMock.mockImplementation(() => {
      throw new Error('hmm');
    });

    // Act & Assert
    expect(() => {
      config.validate({ allowed: 'strict' });
    }).toThrow(`mnemonic: Mnemonic 'valid mnemonic' is not valid: value was "valid mnemonic"`);
  });

  describe('validAlgoAddressFormat', () => {
    test('should validate a valid Algo address', () => {
      // Arrange
      config = convict({
        algoAddress: {
          format: 'validAlgoAddressFormat',
          default: 'valid address',
        },
      });
      isValidAddressMock.mockReturnValue(true);
      // Act
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).not.toThrow();
    });

    test('should throw an error for an invalid Algo address', () => {
      // Arrange
      isValidAddressMock.mockReturnValue(false);

      // Act & Assert
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).toThrow(`algoAddress: Address 'valid address' is not valid: value was "valid address"`);
    });
  });

  describe('webhookUrlValidator', () => {
    test('should validate a valid webhook URL', () => {
      // Arrange
      config = convict({
        webhookUrl: {
          format: 'webhookUrlValidator',
          default: generateFakeWebhookUrl(),
        },
      });

      // Act
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).not.toThrow();
    });

    test('should throw an error for an invalid webhook URL', () => {
      // Arrange
      config.set('webhookUrl', 'invalid webhook URL');

      // Act & Assert
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).toThrow('Invalid webhook URL');
    });
  });

  describe('nonEmptyString', () => {
    test('should validate a non-empty string', () => {
      // Arrange
      config = convict({
        nonEmptyString: {
          format: 'nonEmptyString',
          default: 'valid string',
        },
      });

      // Act
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).not.toThrow();
    });

    test('should throw an error for an empty string', () => {
      // Arrange
      config.set('nonEmptyString', '');

      // Act & Assert
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).toThrow('must be a non-empty string');
    });

    test('should throw an error for a non-string value', () => {
      // Arrange
      config.set('nonEmptyString', 123);

      // Act & Assert
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).toThrow('must be a non-empty string');
    });
  });
});
