import EventEmitter from 'node:events';

import { singleton } from 'tsyringe';

import { DiscordId } from '../types/core.js';
import { globalEmitterLogger } from '../utils/functions/logger-factory.js';

import { GlobalEvent } from './types.js';

export interface IGlobalEmitter {
  emitLoadTemporaryTokens(walletAddress: string, discordUserId: DiscordId): void;
  on(event: string | symbol, listener: (...arguments_: unknown[]) => void): this;
  off(event: string | symbol, listener: (...arguments_: unknown[]) => void): this;
}

@singleton()
export class GlobalEmitter extends EventEmitter implements IGlobalEmitter {
  constructor() {
    super();
    globalEmitterLogger.verbose('Global Emitter initialized');
  }
  override emit(event: string | symbol, ...arguments_: unknown[]): boolean {
    globalEmitterLogger.debug(
      `Event emitted: ${String(event)}, with arguments: ${JSON.stringify(arguments_)}`,
    );
    return super.emit(event, ...arguments_);
  }
  onEvent<T = unknown>(event: string, listener: (...arguments_: T[]) => Promise<void>): void {
    this.on(event, (...arguments_) => {
      globalEmitterLogger.debug(
        `Event received: ${String(event)}, with arguments: ${JSON.stringify(arguments_)}`,
      );
      listener(...arguments_).catch((error: unknown) => {
        globalEmitterLogger.error(`Error handling event ${event}:`, error);
      });
    });
  }
  emitLoadTemporaryTokens(walletAddress: string, discordUserId: DiscordId): void {
    this.emit(GlobalEvent.EmitLoadTemporaryTokens, { walletAddress, discordUserId });
  }
}
