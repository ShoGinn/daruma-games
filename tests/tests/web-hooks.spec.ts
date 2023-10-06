import { BaseMessageOptions, Collection, GuildMember } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { getConfig } from '../../src/config/config.js';
import logger from '../../src/utils/functions/logger-factory.js';
import {
  getWebhooks,
  karmaArtifactWebHook,
  karmaClaimWebHook,
  karmaSendWebHook,
  karmaTipWebHook,
  webHookQueue,
} from '../../src/utils/functions/web-hooks.js';
import { generateFakeWebhookUrl } from '../utils/test-funcs.js';
const config = getConfig();
describe('webhook', () => {
  let client: Client;
  let member: GuildMember | undefined;
  let members: Collection<string, GuildMember> | undefined;

  beforeEach(() => {
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
  it('should set up webhooks when transactionWebhookUrl is defined and client is provided', () => {
    // Arrange

    const client = {} as Client;

    // Act
    getWebhooks(client);

    // Assert
    // Add your assertions here to verify the setup of webhooks
  });

  it('should log an error when transactionWebhookUrl is not defined', () => {
    // Arrange
    config.set('transactionWebhook', '');
    const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

    // Act
    getWebhooks();

    // Assert
    expect(loggerErrorSpy).toHaveBeenCalledWith('No TRANSACTION webhook set');
  });
  it('should create a transaction webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaClaimWebHook({}, member);
    const mockSent = webHookQueue.dequeue() as BaseMessageOptions;
    const mockSentEmbeds = mockSent.embeds as Array<unknown>;
    expect(mockSent?.embeds).toBeDefined();
    expect((mockSentEmbeds[0] as { data: { title: string } }).data.title).toEqual(
      'Claimed (KARMA) -- Algorand Network Transaction',
    );
  });
  it('should create a karma artifact webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaArtifactWebHook({}, member);
    const mockSent = webHookQueue.dequeue() as BaseMessageOptions;
    const mockSentEmbeds = mockSent.embeds as Array<unknown>;
    expect(mockSent?.embeds).toBeDefined();
    expect((mockSentEmbeds[0] as { data: { title: string } }).data.title).toEqual(
      'Artifact Claimed -- Algorand Network Transaction',
    );
  });

  it('should create a karma tip webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaTipWebHook({}, member, member);
    expect(webHookQueue.dequeue()).toHaveProperty('embeds');
  });
  it('should create a karma send webhook message', () => {
    if (!member) {
      throw new Error('Member not found');
    }
    karmaSendWebHook({}, member, member);
    expect(webHookQueue.dequeue()).toHaveProperty('embeds');
  });
});
