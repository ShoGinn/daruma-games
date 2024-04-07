import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client } from 'discord.js';

import { SendTransactionResult } from '@algorandfoundation/algokit-utils/types/transaction';
import { mockGuildMember, mockUser, setupBot } from '@shoginn/discordjs-mock';

import {
  defaultAssetExplorerConfig,
  defaultTransactionExplorerConfig,
} from '../../core/constants.js';
import { TransactionResultOrError } from '../../types/algorand.js';

import * as algoEmbeds from './algo-embeds.js';

describe('buildYesNoButtons', () => {
  test('returns a message action row with two buttons', () => {
    const buttonId = 'test-id';
    const result = algoEmbeds.buildYesNoButtons(buttonId);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(2);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0]!.toJSON()).toEqual({
      custom_id: 'simple-yes_test-id',
      emoji: { animated: false, id: undefined, name: '✅' },
      style: ButtonStyle.Primary,
      type: 2,
    });
    expect(components[1]!.toJSON()).toEqual({
      custom_id: 'simple-no_test-id',
      emoji: { animated: false, id: undefined, name: '❌' },
      style: ButtonStyle.Secondary,
      type: 2,
    });
  });
});
describe('buildAddRemoveButtons', () => {
  test('returns a message action row with two buttons', () => {
    const buttonId = 'test-id';
    const buttonName = 'test-name';
    const result = algoEmbeds.buildAddRemoveButtons(buttonId, buttonName, true);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(2);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0]!.toJSON()).toEqual({
      custom_id: 'simple-add-test-name_test-id',
      emoji: {
        animated: false,
        id: undefined,
        name: '➕',
      },
      style: ButtonStyle.Primary,
      type: 2,
    });
    expect(components[1]!.toJSON()).toEqual({
      custom_id: 'simple-remove-test-name_test-id',
      emoji: {
        animated: false,
        id: undefined,
        name: '➖',
      },
      style: ButtonStyle.Danger,
      type: 2,
    });
  });
  test('returns a message action row with one', () => {
    const buttonId = 'test-id';
    const buttonName = 'test-name';
    const result = algoEmbeds.buildAddRemoveButtons(buttonId, buttonName);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(1);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0]!.toJSON()).toEqual({
      custom_id: 'simple-add-test-name_test-id',
      emoji: {
        animated: false,
        id: undefined,
        name: '➕',
      },
      style: ButtonStyle.Primary,
      type: 2,
    });
    expect(components[1]).toBeUndefined();
  });
});
describe('buildCustomButton', () => {
  test('returns a button builder', () => {
    const buttonId = 'test-id';
    const buttonLabel = 'test-label';
    const result = algoEmbeds.customButton(buttonId, buttonLabel);

    expect(result).toBeInstanceOf(ButtonBuilder);
    expect(result.toJSON()).toEqual({
      custom_id: 'custom-button_test-id',
      emoji: undefined,
      label: 'test-label',
      style: ButtonStyle.Secondary,
      type: 2,
    });
  });
});
describe('createTransactionExplorerButton', () => {
  test('should return an ActionRowBuilder when txId is not provided no matter what', () => {
    // Arrange
    const txId = '';

    // Act
    const result = algoEmbeds.createTransactionExplorerButton(txId);

    // Assert
    expect(result).toBeInstanceOf(ActionRowBuilder);
    expect(result.components).toHaveLength(1);
  });

  test('should return an ActionRowBuilder with a Link button when txId is provided', () => {
    // Arrange
    const txId = '1234567890';

    // Act
    const result = algoEmbeds.createTransactionExplorerButton(txId);

    // Assert
    expect(result).toBeInstanceOf(ActionRowBuilder);
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toBeInstanceOf(ButtonBuilder);
    const expectedUrl = `${defaultTransactionExplorerConfig.baseUrl}${defaultTransactionExplorerConfig.pathFormat.replace('{txnId}', txId)}`;
    expect(result.components[0]!.toJSON()).toEqual({
      custom_id: undefined,
      emoji: undefined,
      label: 'View transaction on the Blockchain',
      style: ButtonStyle.Link,
      type: 2,
      url: expectedUrl,
    });
  });
});
describe('createSendAssetEmbed', () => {
  let client: Client;
  let sender: ReturnType<typeof mockUser>;
  let recipient: ReturnType<typeof mockGuildMember>;
  let assetName: string;
  beforeAll(async () => {
    client = await setupBot();
    sender = mockUser(client);
    recipient = mockGuildMember({ client: client });
    assetName = 'test-asset';
  });
  test('should return an embed with the correct fields', () => {
    // Arrange
    const amount = 100;

    // Act
    const result = algoEmbeds.createSendAssetEmbed(assetName, amount, sender, recipient);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `Processing the transaction of ${amount} ${assetName} to ${recipient.toString()}...`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: sender.username,
      icon_url: sender.displayAvatarURL(),
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toBeUndefined();
  });
  test('should return an embed with the correct fields when reason is provided', () => {
    // Arrange
    const amount = 100;
    const reason = 'test-reason';

    // Act
    const result = algoEmbeds.createSendAssetEmbed(assetName, amount, sender, recipient, reason);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `Processing the transaction of ${amount} ${assetName} to ${recipient.toString()}...`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: sender.username,
      icon_url: sender.displayAvatarURL(),
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toEqual([
      {
        name: 'Reason Sent',
        value: reason,
      },
    ]);
  });
});
describe('claimTokenResponseEmbedUpdate', () => {
  let client: Client;
  let author: ReturnType<typeof mockUser>;
  let recipient: ReturnType<typeof mockGuildMember>;
  let assetName: string;

  beforeAll(async () => {
    client = await setupBot();
    author = mockUser(client);
    recipient = mockGuildMember({ client: client });
    assetName = 'test-asset';
  });

  test('should return an embed with the correct fields', () => {
    // Arrange
    const claimStatus = {
      transaction: {
        txID() {
          return '1234567890';
        },
        amount: 100,
      },
      confirmation: {
        confirmedRound: 123,
      },
    } as SendTransactionResult;
    const embed = algoEmbeds.createSendAssetEmbed(assetName, 100, author, recipient);

    // Act
    const result = algoEmbeds.claimTokenResponseEmbedUpdate(
      embed,
      assetName,
      claimStatus,
      recipient,
    );

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(`Sent 100 ${assetName} to ${recipient.toString()}`);
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: author.username,
      icon_url: author.displayAvatarURL(),
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toEqual([
      {
        name: 'Txn ID',
        value: claimStatus.transaction.txID(),
      },
      {
        name: 'Txn Hash',
        value: claimStatus.confirmation?.confirmedRound?.toString(),
      },
      {
        name: 'Transaction Amount',
        value: '100',
      },
    ]);
  });
  test('should return an error embed when claimStatus.txId is undefined', () => {
    // Arrange
    const claimStatus = {
      error: true,
      message: 'test-error',
    } as TransactionResultOrError;

    const embed = algoEmbeds.createSendAssetEmbed(assetName, 100, author, recipient);

    // Act
    const result = algoEmbeds.claimTokenResponseEmbedUpdate(
      embed,
      assetName,
      claimStatus,
      recipient,
    );

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `There was an error sending the ${assetName} to ${recipient.toString()}`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: author.username,
      icon_url: author.displayAvatarURL(),
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toEqual([
      { name: 'error', value: 'true', inline: true },
      { name: 'message', value: 'test-error', inline: true },
    ]);
  });
});
describe('humanFriendlyClaimStatus', () => {
  test('should return a human friendly object', () => {
    // Arrange
    const claimStatus = {
      transaction: {
        txID() {
          return '1234567890';
        },
        amount: 100,
      },
      confirmation: {
        confirmedRound: 123,
      },
    } as SendTransactionResult;

    // Act
    const result = algoEmbeds.humanFriendlyClaimStatus(claimStatus);
    // Assert
    expect(result).toEqual({
      txId: claimStatus.transaction.txID(),
      confirmedRound: claimStatus.confirmation?.confirmedRound?.toString(),
      transactionAmount: '100',
    });
  });
  test('should return a human friendly object when claimStatus is undefined', () => {
    // Arrange
    const claimStatus = {
      transaction: {
        txID() {
          return;
        },
        amount: 100,
      },
    } as SendTransactionResult;

    // Act
    const result = algoEmbeds.humanFriendlyClaimStatus(claimStatus);
    // Assert
    expect(result).toEqual({
      txId: 'Unknown',
      confirmedRound: 'Unknown',
      transactionAmount: '100',
    });
  });
});
describe('jsonToEmbedFields', () => {
  it('should convert a JSON string to an array of APIEmbedFields', () => {
    const json = '{"error":true,"message":"Insufficient funds"}';
    const expected = [
      { name: 'error', value: 'true', inline: true },
      { name: 'message', value: 'Insufficient funds', inline: true },
    ];
    const result = algoEmbeds.jsonToEmbedFields(json);
    expect(result).toEqual(expected);
  });

  it('should handle non-string values correctly', () => {
    const json = '{"error":true,"count":123}';
    const expected = [
      { name: 'error', value: 'true', inline: true },
      { name: 'count', value: '123', inline: true },
    ];
    const result = algoEmbeds.jsonToEmbedFields(json);
    expect(result).toEqual(expected);
  });

  it('should handle empty JSON correctly', () => {
    const json = '{}';
    const expected: unknown[] = [];
    const result = algoEmbeds.jsonToEmbedFields(json);
    expect(result).toEqual(expected);
  });
});
describe('explorer url generators', () => {
  it('should generate the correct asset explorer URL string', () => {
    const assetId = '1234';
    const expectedUrl = `${defaultAssetExplorerConfig.baseUrl}${defaultAssetExplorerConfig.pathFormat.replace('{assetId}', assetId)}`;
    expect(algoEmbeds.generateAssetExplorerUrl(assetId)).toBe(expectedUrl);
  });
  it('should generate the correct asset explorer URL number', () => {
    const assetId = 1234;
    const expectedUrl = `${defaultAssetExplorerConfig.baseUrl}${defaultAssetExplorerConfig.pathFormat.replace('{assetId}', String(assetId))}`;
    expect(algoEmbeds.generateAssetExplorerUrl(assetId)).toBe(expectedUrl);
  });

  it('should generate the correct transaction explorer URL', () => {
    const txnId = 'abcd';
    const expectedUrl = `${defaultTransactionExplorerConfig.baseUrl}${defaultTransactionExplorerConfig.pathFormat.replace('{txnId}', txnId)}`;
    expect(algoEmbeds.generateTransactionExplorerUrl(txnId)).toBe(expectedUrl);
  });
});
