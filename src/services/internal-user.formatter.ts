import Handlebars from 'handlebars';

import { InternalUser } from './internal-user.js';

export const walletActionsTemplate = {
  WalletAdded: Handlebars.compile(
    'Wallet {{walletAddress}} added to user {{internalUser.username}}',
  ),
  WalletAlreadyExists: Handlebars.compile(
    'Wallet {{walletAddress}} already exists for user {{internalUser.username}}',
  ),
  ErrorAddingWallet: Handlebars.compile(
    'Error adding wallet {{walletAddress}} to user {{internalUser.username}}',
  ),
  WalletRemoved: Handlebars.compile(
    'Wallet {{walletAddress}} removed from user {{internalUser.username}}',
  ),
};
export const InternalUserNotFound = Handlebars.compile(
  'Internal user {{internalUser.username}} not found',
);

/*
Specific Parsers
*/
const removeInternalUserWalletMessageParserTemplate = Handlebars.compile(`
{{#if deletedCount}}{{deletedCount}} assets removed.{{/if}}
{{#if walletRemoved}}Wallet {{walletAddress}} removed from user {{internalUser.username}}.{{/if}}
{{#if walletNotFound}}Wallet {{walletAddress}} not found.{{/if}}
`);

export function removeInternalUserWalletMessageParser(
  walletAddress: string,
  internalUser: InternalUser,
  modifiedCount: number,
  matchedCount: number,
  deletedCount?: number,
): string {
  const walletNotFound = matchedCount === 0;
  const walletRemoved = matchedCount > 0 && modifiedCount > 0;

  const message = removeInternalUserWalletMessageParserTemplate({
    deletedCount,
    walletAddress,
    internalUser,
    walletRemoved,
    walletNotFound,
  });

  // Split the message by newline, filter out any empty lines, then join them back together with a space
  return message.trim();
}
