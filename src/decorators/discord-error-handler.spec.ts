/* eslint-disable @typescript-eslint/no-explicit-any */
import { ButtonInteraction, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

import { anything, instance, mock, verify, when } from 'ts-mockito';

import logger from '../utils/functions/logger-factory.js';

import { customDeferReply, withCustomDiscordApiErrorLogger } from './discord-error-handler.js';

function subFunction(): void {
  throw new DiscordAPIError(
    { code: RESTJSONErrorCodes.UnknownInteraction, message: 'Test Debug' },
    RESTJSONErrorCodes.UnknownInteraction,
    500,
    'GET',
    '/test',
    {},
  );
}
describe('customDeferReply', () => {
  let interaction: ButtonInteraction;
  let mockedInteraction: ButtonInteraction;

  beforeEach(() => {
    mockedInteraction = mock(ButtonInteraction);
    interaction = instance(mockedInteraction);
  });

  test('should call deferReply with the provided ephemeral value', async () => {
    await customDeferReply(interaction, true);
    verify(mockedInteraction.deferReply(anything())).once();
  });

  test('should call deferReply with the default ephemeral value when not provided', async () => {
    await customDeferReply(interaction);
    verify(mockedInteraction.deferReply(anything())).once();
  });

  test('should handle DiscordAPIError when deferReply throws a DiscordAPIError', async () => {
    const error = new DiscordAPIError(
      { code: RESTJSONErrorCodes.UnknownInteraction, message: 'Test Debug' },
      RESTJSONErrorCodes.UnknownInteraction,
      500,
      'GET',
      '/test',
      {},
    );
    when(mockedInteraction.deferReply(anything())).thenThrow(error);

    await customDeferReply(interaction);
    verify(mockedInteraction.deferReply(anything())).once();
  });
});
describe('withErrorHandling decorator', () => {
  let targetFunction: any;
  let loggerErrorSpy: jest.SpyInstance<void, [any]>;
  let loggerDebugSpy: jest.SpyInstance<void, [any]>;

  beforeEach(() => {
    // Create a spy for the logger function
    loggerErrorSpy = jest.spyOn(logger, 'error') as jest.SpyInstance;
    loggerDebugSpy = jest.spyOn(logger, 'debug') as jest.SpyInstance;
  });

  afterEach(() => {
    // Clear the logger spy after each test
    loggerErrorSpy.mockClear();
    loggerDebugSpy.mockClear();
  });

  describe('when an error that is not an interaction or message error is thrown', () => {
    beforeEach(() => {
      // Create a test class and method with the decorator
      class TestClass {
        @withCustomDiscordApiErrorLogger
        testMethod(): void {
          throw new DiscordAPIError(
            { code: 500, message: 'Test Error' },
            500,
            500,
            'GET',
            '/test',
            {},
          );
        }
      }

      // Instantiate the test class and get a reference to the decorated method
      const testObject = new TestClass();
      targetFunction = testObject.testMethod.bind(testObject);
    });

    test('should call the logger function', () => {
      // Call the decorated method and expect the logger function to be called with the error
      targetFunction();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test Error' }),
      );
    });
  });
  describe('when a message or interaction error is thrown', () => {
    beforeEach(() => {
      // Create a test class and method with the decorator
      class TestClass {
        @withCustomDiscordApiErrorLogger
        testMethod(): void {
          throw new DiscordAPIError(
            {
              code: RESTJSONErrorCodes.UnknownInteraction,
              message: 'Test Debug',
            },
            RESTJSONErrorCodes.UnknownInteraction,
            500,
            'GET',
            '/test',
            {},
          );
        }
      }

      // Instantiate the test class and get a reference to the decorated method
      const testObject = new TestClass();
      targetFunction = testObject.testMethod.bind(testObject);
    });

    test('should call the logger function', () => {
      // Call the decorated method and expect the logger function to be called with the error
      targetFunction();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(0);
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith('Unknown Interaction or Message');
    });
  });
  describe('when a message or interaction error is thrown in a sub function', () => {
    beforeEach(() => {
      // Create a test class and method with the decorator
      class TestClass {
        @withCustomDiscordApiErrorLogger
        testMethod(): void {
          subFunction();
        }
      }

      // Instantiate the test class and get a reference to the decorated method
      const testObject = new TestClass();
      targetFunction = testObject.testMethod.bind(testObject);
    });

    test('should call the logger function', () => {
      // Call the decorated method and expect the logger function to be called with the error
      targetFunction();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(0);
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith('Unknown Interaction or Message');
    });
  });

  describe('when an error is not thrown', () => {
    beforeEach(() => {
      // Create a test class and method with the decorator
      class TestClass {
        @withCustomDiscordApiErrorLogger
        testMethod(): string {
          return 'Success!';
        }
      }

      // Instantiate the test class and get a reference to the decorated method
      const testObject = new TestClass();
      targetFunction = testObject.testMethod.bind(testObject);
    });

    test('should not call the logger function', () => {
      // Call the decorated method and expect the logger function to not be called
      expect(targetFunction()).toBe('Success!');
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });
});
