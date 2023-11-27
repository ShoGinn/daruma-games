import { TransactionResultOrError } from '../types/algorand.js';
import logger from '../utils/functions/logger-factory.js';

export function handleTransferErrors(error: unknown): string {
  const errorTypes = [
    {
      regex:
        /TransactionPool\.Remember: transaction ([\dA-Za-z]+): underflow on subtracting (\d+) from sender amount (\d+)/,
      handler: (match: RegExpExecArray) => {
        const transactionId = match[1];
        const subtractedAmount = match[2];
        const senderAmount = match[3];
        return `Insufficient funds: Tried to subtract ${subtractedAmount} from sender amount ${senderAmount} in transaction ${transactionId}`;
      },
    },
    {
      regex:
        /TransactionPool\.Remember: transaction ([\dA-Za-z]+): asset (\d+) missing from ([\dA-Za-z]+)/,
      handler: (match: RegExpExecArray) => {
        const transactionId = match[1];
        const assetId = match[2];
        const missingFrom = match[3];
        return `Missing asset: Asset ${assetId} missing from ${missingFrom} in transaction ${transactionId}`;
      },
    },
    // Add more error types here
  ];

  if (error instanceof Error) {
    for (const errorType of errorTypes) {
      const match = errorType.regex.exec(error.message);
      if (match) {
        return errorType.handler(match);
      }
    }
  }

  logger.error(error);
  return `Unexpected error occurred while sending transaction to the network ${JSON.stringify(
    error,
  )}`;
}
export function isTransferError(
  result: TransactionResultOrError,
): result is { error: true; message: string } {
  return 'error' in result;
}
