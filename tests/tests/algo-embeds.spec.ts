import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client } from 'discord.js';

import { mockGuildMember, mockUser, setupBot } from '@shoginn/discordjs-mock';

import { ClaimTokenResponse } from '../../src/types/algorand.js';
import {
  buildAddRemoveButtons,
  buildYesNoButtons,
  claimTokenResponseEmbedUpdate,
  createAlgoExplorerButton,
  createSendAssetEmbed,
  customButton,
  humanFriendlyClaimStatus,
} from '../../src/utils/functions/algo-embeds.js';

describe('buildYesNoButtons', () => {
  test('returns a message action row with two buttons', () => {
    const buttonId = 'test-id';
    const result = buildYesNoButtons(buttonId);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(2);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0].toJSON()).toEqual({
      custom_id: 'simple-yes_test-id',
      emoji: { animated: false, id: undefined, name: '✅' },
      style: ButtonStyle.Primary,
      type: 2,
    });
    expect(components[1].toJSON()).toEqual({
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
    const result = buildAddRemoveButtons(buttonId, buttonName, true);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(2);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0].toJSON()).toEqual({
      custom_id: 'simple-add-test-name_test-id',
      emoji: {
        animated: false,
        id: undefined,
        name: '➕',
      },
      style: ButtonStyle.Primary,
      type: 2,
    });
    expect(components[1].toJSON()).toEqual({
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
    const result = buildAddRemoveButtons(buttonId, buttonName);

    expect(result).toBeInstanceOf(ActionRowBuilder);
    const { components } = result;
    expect(components).toHaveLength(1);
    expect(components[0]).toBeInstanceOf(ButtonBuilder);
    expect(components[0].toJSON()).toEqual({
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
    const result = customButton(buttonId, buttonLabel);

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
describe('createAlgoExplorerButton', () => {
  test('should return an ActionRowBuilder when txId is not provided no matter what', () => {
    // Arrange
    const txId = undefined;

    // Act
    const result = createAlgoExplorerButton(txId);

    // Assert
    expect(result).toBeInstanceOf(ActionRowBuilder);
    expect(result.components).toHaveLength(1);
  });

  test('should return an ActionRowBuilder with a Link button when txId is provided', () => {
    // Arrange
    const txId = '1234567890';

    // Act
    const result = createAlgoExplorerButton(txId);

    // Assert
    expect(result).toBeInstanceOf(ActionRowBuilder);
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toBeInstanceOf(ButtonBuilder);
    expect(result.components[0].toJSON()).toEqual({
      custom_id: undefined,
      emoji: undefined,
      label: 'AlgoExplorer',
      style: ButtonStyle.Link,
      type: 2,
      url: 'https://algoexplorer.io/tx/1234567890',
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
    const result = createSendAssetEmbed(assetName, amount, sender, recipient);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `Processing the transaction of ${amount} ${assetName} to ${recipient.toString()}...`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: sender.username,
      icon_url: sender.displayAvatarURL() ?? '',
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toBeUndefined();
  });
  test('should return an embed with the correct fields when reason is provided', () => {
    // Arrange
    const amount = 100;
    const reason = 'test-reason';

    // Act
    const result = createSendAssetEmbed(assetName, amount, sender, recipient, reason);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `Processing the transaction of ${amount} ${assetName} to ${recipient.toString()}...`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: sender.username,
      icon_url: sender.displayAvatarURL() ?? '',
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
      status: {
        'confirmed-round': 123,
        txn: {
          txn: {
            aamt: 100,
          },
        },
      },
      txId: '1234567890',
    } as unknown as ClaimTokenResponse;
    const embed = createSendAssetEmbed(assetName, 100, author, recipient);

    // Act
    const result = claimTokenResponseEmbedUpdate(embed, assetName, claimStatus, recipient);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(`Sent 100 ${assetName} to ${recipient.toString()}`);
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: author.username,
      icon_url: author.displayAvatarURL() ?? '',
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toEqual([
      {
        name: 'Txn ID',
        value: claimStatus.txId,
      },
      {
        name: 'Txn Hash',
        value: claimStatus.status?.['confirmed-round']?.toString(),
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
      status: {
        'confirmed-round': 123,
        txn: {
          txn: {
            aamt: 100,
          },
        },
      },
      txId: '',
    } as unknown as ClaimTokenResponse;

    const embed = createSendAssetEmbed(assetName, 100, author, recipient);

    // Act
    const result = claimTokenResponseEmbedUpdate(embed, assetName, claimStatus, recipient);

    // Assert
    expect(result).toBeInstanceOf(Object);
    expect(result.data.description).toBe(
      `There was an error sending the ${assetName} to ${recipient.toString()}`,
    );
    expect(result.data.title).toBe(`${assetName} Algorand Network Transaction`);
    expect(result.data.author).toEqual({
      name: author.username,
      icon_url: author.displayAvatarURL() ?? '',
    });
    expect(result.data.timestamp).toBeDefined();
    expect(result.data.fields).toEqual([
      {
        name: 'Error',
        value: JSON.stringify(claimStatus),
      },
    ]);
  });
});
describe('humanFriendlyClaimStatus', () => {
  test('should return a human friendly object', () => {
    // Arrange
    const claimStatus = {
      status: {
        'confirmed-round': 123,
        txn: {
          txn: {
            aamt: 100,
          },
        },
      },
      txId: '1234567890',
    } as unknown as ClaimTokenResponse;

    // Act
    const result = humanFriendlyClaimStatus(claimStatus);
    // Assert
    expect(result).toEqual({
      txId: claimStatus.txId,
      confirmedRound: claimStatus.status?.['confirmed-round']?.toString(),
      transactionAmount: '100',
    });
  });
  test('should return a human friendly object when claimStatus is undefined', () => {
    // Arrange
    const claimStatus = {
      status: {
        'confirmed-round': null,
        txn: {
          txn: {
            aamt: undefined,
          },
        },
      },
      txId: undefined,
    } as unknown as ClaimTokenResponse;

    // Act
    const result = humanFriendlyClaimStatus(claimStatus);
    // Assert
    expect(result).toEqual({
      txId: 'Unknown',
      confirmedRound: 'Unknown',
      transactionAmount: 'Unknown',
    });
  });
});
