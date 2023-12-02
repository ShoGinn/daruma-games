import { BaseMessageOptions, Collection, GuildMember } from 'discord.js';

import { Client } from 'discordx';

import { SendTransactionResult } from '@algorandfoundation/algokit-utils/types/transaction';
import { mock, when } from 'ts-mockito';
import { container } from 'tsyringe';

import { generateFakeWebhookUrl } from '../../../tests/setup/test-funcs.js';
import { getConfig } from '../../config/config.js';

import logger from './logger-factory.js';
import {
  initializeWebhooks,
  karmaArtifactWebHook,
  karmaClaimWebHook,
  karmaSendWebHook,
  karmaTipWebHook,
  webHookQueue,
} from './web-hooks.js';

const config = getConfig();
describe('webhook', () => {
  let client: Client;
  let member: GuildMember | undefined;
  let members: Collection<string, GuildMember> | undefined;
  let mockSendTransactionResult: SendTransactionResult;
  beforeEach(() => {
    mockSendTransactionResult = {
      transaction: mock(),
    };
    when(mockSendTransactionResult.transaction.txID()).thenReturn('test-tx-id');
    mockSendTransactionResult.transaction.amount = 1_000_000;
    config.set('transactionWebhook', generateFakeWebhookUrl());
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  beforeAll(() => {
    client = container.resolve(Client);
    // fetch members from the mock guild
    const guild = client.guilds.cache.first();
    members = guild?.members.cache;
    // set a member from the mock guild
    member = members?.first();
  });
  test('should set up webhooks when transactionWebhookUrl is defined and client is provided', () => {
    // Arrange

    const client = {} as Client;

    // Act
    initializeWebhooks(client);

    // Assert
    expect.assertions(0);
    // Add your assertions here to verify the setup of webhooks
  });

  test('should log an error when transactionWebhookUrl is not defined', () => {
    // Arrange
    config.set('transactionWebhook', '');
    const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

    // Act
    initializeWebhooks();

    // Assert
    expect(loggerErrorSpy).toHaveBeenCalledWith('No TRANSACTION webhook set');
  });
  test('should create a transaction webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaClaimWebHook(mockSendTransactionResult, member);
    const mockSent = webHookQueue.dequeue() as BaseMessageOptions;
    const mockSentEmbeds = mockSent.embeds as unknown[];
    expect(mockSent?.embeds).toBeDefined();
    expect((mockSentEmbeds[0] as { data: { title: string } }).data.title).toBe(
      'Claimed (KARMA) -- Algorand Network Transaction',
    );
  });
  test('should create a karma artifact webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaArtifactWebHook(mockSendTransactionResult, member);
    const mockSent = webHookQueue.dequeue() as BaseMessageOptions;
    const mockSentEmbeds = mockSent.embeds as unknown[];
    expect(mockSent?.embeds).toBeDefined();
    expect((mockSentEmbeds[0] as { data: { title: string } }).data.title).toBe(
      'Artifact Claimed -- Algorand Network Transaction',
    );
  });
  test('should return undefined when member is undefined', () => {
    const result = karmaClaimWebHook(mockSendTransactionResult);
    expect(result).toBeUndefined();
  });
  test('should return an unknown amount when transaction amount is undefined', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    mockSendTransactionResult.transaction.amount = undefined as unknown as number;
    karmaClaimWebHook(mockSendTransactionResult, member);
    const mockSent = webHookQueue.dequeue() as BaseMessageOptions;
    expect(mockSent?.embeds).toBeDefined();
  });
  test('should create a karma tip webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaTipWebHook(mockSendTransactionResult, member, member);
    expect(webHookQueue.dequeue()).toHaveProperty('embeds');
  });
  test('should create a karma send webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaSendWebHook(mockSendTransactionResult, member, member);
    expect(webHookQueue.dequeue()).toHaveProperty('embeds');
  });
});
