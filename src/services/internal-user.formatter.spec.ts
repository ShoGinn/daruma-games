import { InternalUserIDs } from '../enums/daruma-training.js';

import {
  formatMessage,
  getInternalUserName,
  removeInternalUserWalletMessageParser,
  WalletUserMessageFormats,
} from './internal-user.formatter.js';

describe('Message Formatting', () => {
  describe('formatMessage', () => {
    it('formats a message with correct arguments', () => {
      const result = formatMessage(WalletUserMessageFormats.WalletAdded, 'wallet1', 'user1');
      expect(result).toBe('Wallet wallet1 added to user user1');
    });

    it('throws an error when incorrect number of arguments are provided', () => {
      expect(() => {
        formatMessage(WalletUserMessageFormats.WalletAdded, 'wallet1');
      }).toThrow();
    });
  });

  describe('getInternalUserName', () => {
    it('returns the correct internal user name', () => {
      const result = getInternalUserName(InternalUserIDs.creator);
      expect(result).toBe('Creator'); // Replace with the actual name for InternalUserIDs.creator
    });

    it('throws an error for an invalid internal user ID', () => {
      expect(() => getInternalUserName('invalid-id' as unknown as InternalUserIDs)).toThrow();
    });
  });

  describe('removeInternalUserWalletMessageParser', () => {
    it('returns a message for removed wallet', () => {
      const result = removeInternalUserWalletMessageParser(
        'wallet1',
        InternalUserIDs.creator,
        1,
        1,
      );
      expect(result).toBe('Wallet wallet1 removed from user Creator');
    });
    it('returns a message for deleted assets and removed wallet', () => {
      const result = removeInternalUserWalletMessageParser(
        'wallet1',
        InternalUserIDs.creator,
        1,
        1,
        5,
      );
      expect(result).toBe('5 assets removed Wallet wallet1 removed from user Creator');
    });

    it('returns a message for wallet not found', () => {
      const result = removeInternalUserWalletMessageParser(
        'wallet1',
        InternalUserIDs.creator,
        0,
        0,
      );
      expect(result).toBe('Wallet wallet1 not found');
    });

    it('returns a message for no action (wallet exists, no assets deleted)', () => {
      const result = removeInternalUserWalletMessageParser(
        'wallet1',
        InternalUserIDs.creator,
        0,
        1,
      );
      expect(result).toBe('');
    });
  });
});
