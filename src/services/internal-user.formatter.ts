import util from 'node:util';

import { InternalUserIDs, internalUsernames } from '../enums/daruma-training.js';

export enum WalletUserMessageFormats {
  WalletAdded = 'Wallet %s added to user %s',
  WalletAlreadyExists = 'Wallet %s already exists for user %s',
  ErrorAddingWallet = 'Error adding wallet %s to user %s',
  WalletRemoved = 'Wallet %s removed from user %s',
}

export enum WalletMessageFormats {
  WalletNotFound = 'Wallet %s not found',
}

export enum InternalUserMessageFormats {
  InternalUserNotFound = 'Internal user %s not found',
}

export enum AssetMessageFormats {
  AssetsRemoved = '%s assets removed',
}
export function formatMessage(format: string, ...arguments_: Array<string | number>): string {
  // Check to see if the length of arguments matches the length of arguments in the format string
  const formatArguments = format.match(/%s/g);
  if (formatArguments && formatArguments.length !== arguments_.length) {
    throw new Error(
      `Format string ${format} requires ${formatArguments.length} arguments, but ${arguments_.length} were provided`,
    );
  }
  return util.format(format, ...arguments_);
}
export function getInternalUserName(internalUser: InternalUserIDs): string {
  const userString = internalUsernames[internalUser];
  if (!userString) {
    throw new Error(`Internal User ID ${internalUser} not found`);
  }
  return userString;
}

/*
Specific Parsers
*/
export function removeInternalUserWalletMessageParser(
  walletAddress: string,
  internalUserId: InternalUserIDs,
  modifiedCount: number,
  matchedCount: number,
  deletedCount?: number,
): string {
  const internalUserName = getInternalUserName(internalUserId);
  const deletedMessage = deletedCount
    ? formatMessage(AssetMessageFormats.AssetsRemoved, deletedCount)
    : '';

  const walletExists = matchedCount > 0 && modifiedCount === 0;
  const walletsRemovedMessage =
    modifiedCount > 0 && !walletExists
      ? formatMessage(WalletUserMessageFormats.WalletRemoved, walletAddress, internalUserName)
      : '';
  const walletNotFoundMessage =
    matchedCount === 0 ? formatMessage(WalletMessageFormats.WalletNotFound, walletAddress) : '';
  const message = `${deletedMessage} ${walletsRemovedMessage} ${walletNotFoundMessage}`;
  return message.split(' ').filter(Boolean).join(' ').trim();
}
