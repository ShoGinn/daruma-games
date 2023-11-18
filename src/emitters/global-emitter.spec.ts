import { UnclaimedAsset, WalletWithUnclaimedAssets } from '../types/algorand.js';
import { DiscordId } from '../types/core.js';
import { globalEmitterLogger } from '../utils/functions/logger-factory.js';

import { GlobalEmitter } from './global-emitter.js';
import { GlobalEvent } from './types.js';

describe('GlobalEmitter', () => {
  let globalEmitter: GlobalEmitter;
  let spyLoggerDebug;
  let spyLoggerError;

  beforeEach(() => {
    spyLoggerDebug = jest.spyOn(globalEmitterLogger, 'debug').mockImplementation();
    spyLoggerError = jest.spyOn(globalEmitterLogger, 'error').mockImplementation();

    globalEmitter = new GlobalEmitter();
  });

  it('should log when an event is emitted', () => {
    globalEmitter.emit('testEvent', 'testArg');
    expect(spyLoggerDebug).toHaveBeenCalledWith(
      'Event emitted: testEvent, with arguments: ["testArg"]',
    );
  });

  it('should log when an event is received', async () => {
    const listener = jest.fn().mockResolvedValue('');
    globalEmitter.onEvent('testEvent', listener);
    globalEmitter.emit('testEvent', 'testArg');
    await new Promise(setImmediate); // Wait for event loop to process promise
    expect(spyLoggerDebug).toHaveBeenCalledWith(
      'Event received: testEvent, with arguments: ["testArg"]',
    );
  });

  it('should log an error when an event listener throws an error', async () => {
    const error = new Error('Test error');
    const listener = jest.fn().mockRejectedValue(error);
    globalEmitter.onEvent('testEvent', listener);
    globalEmitter.emit('testEvent', 'testArg');
    await new Promise(setImmediate); // Wait for event loop to process promise
    expect(spyLoggerError).toHaveBeenCalledWith(`Error handling event testEvent:`, error);
  });
  describe('specific emitters', () => {
    test('emitLoadTemporaryTokens', () => {
      const spy = jest.spyOn(globalEmitter, 'emit');
      const walletAddress = 'test';
      const discordUserId = 'test' as DiscordId;
      globalEmitter.emitLoadTemporaryTokens(walletAddress, discordUserId);
      expect(spy).toHaveBeenCalledWith(GlobalEvent.EmitLoadTemporaryTokens, {
        walletAddress,
        discordUserId,
      });
    });
    test('emitRemoveUnclaimedTokensFromMultipleWallets', () => {
      const spy = jest.spyOn(globalEmitter, 'emit');
      const wallets: WalletWithUnclaimedAssets[] = [
        {
          walletAddress: 'test',
          unclaimedTokens: 1,
          discordUserId: 'test' as DiscordId,
        },
      ];
      const assetIndex: UnclaimedAsset = {
        _id: 1,
        name: 'test',
        unitName: 'test',
      };
      globalEmitter.emitRemoveUnclaimedTokensFromMultipleWallets(wallets, assetIndex);
      expect(spy).toHaveBeenCalledWith(GlobalEvent.EmitRemoveUnclaimedTokensFromMultipleWallets, {
        wallets,
        assetIndex,
      });
    });
  });
});
