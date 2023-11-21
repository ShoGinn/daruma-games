import { removeInternalUserWalletMessageParser } from './internal-user.formatter.js';
import { internalUserCreator } from './internal-user.js';

describe('Message Formatting', () => {
  describe('removeInternalUserWalletMessageParser', () => {
    it('returns a message for removed wallet', () => {
      const result = removeInternalUserWalletMessageParser('wallet1', internalUserCreator, 1, 1);
      expect(result).toBe('Wallet wallet1 removed from user Creator.');
    });
    it('returns a message for deleted assets and removed wallet', () => {
      const result = removeInternalUserWalletMessageParser('wallet1', internalUserCreator, 1, 1, 5);
      expect(result).toBe('5 assets removed.\nWallet wallet1 removed from user Creator.');
    });

    it('returns a message for wallet not found', () => {
      const result = removeInternalUserWalletMessageParser('wallet1', internalUserCreator, 0, 0);
      expect(result).toBe('Wallet wallet1 not found.');
    });

    it('returns a message for no action (wallet exists, no assets deleted)', () => {
      const result = removeInternalUserWalletMessageParser('wallet1', internalUserCreator, 0, 1);
      expect(result).toBe('');
    });
  });
});
