import Handlebars from 'handlebars';

export const userWalletOwnedTemplate = {
  WalletFoundOnNFDomains: Handlebars.compile(
    'This Wallet: {{walletAddress}} was found on NF Domains and is not associated with your Discord account: {{discordUserId}}. Please contact an admin if you believe this is an error.',
  ),
  WalletOwnedByAnotherUser: Handlebars.compile(
    'This Wallet: {{walletAddress}} is already associated with another Discord account or has been explicitly reserved. Please contact an admin if you believe this is an error.',
  ),
};

export const userWalletActionsTemplate = {
  WalletAdded: Handlebars.compile(
    'Wallet: {{walletAddress}} added to Discord account: {{discordUserId}}',
  ),
  WalletAlreadyExists: Handlebars.compile(
    'Wallet: {{walletAddress}} already exists on Discord account: {{discordUserId}}',
  ),
  ErrorAddingWallet: Handlebars.compile(
    'Error adding Wallet: {{walletAddress}} to Discord account: {{discordUserId}}',
  ),
};
