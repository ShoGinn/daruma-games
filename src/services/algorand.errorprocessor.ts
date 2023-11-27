import { TransactionResultOrError } from '../types/algorand.js';
import logger from '../utils/functions/logger-factory.js';

export function handleTransferErrors(error: unknown): string {
  const insufficientFundsError =
    /TransactionPool\.Remember: transaction ([\dA-Z]+): underflow on subtracting (\d+) from sender amount (\d+)/;

  if (error instanceof Error) {
    const match = insufficientFundsError.exec(error.message);
    if (match) {
      const transactionId = match[1];
      const subtractedAmount = match[2];
      const senderAmount = match[3];
      return `Insufficient funds: Tried to subtract ${subtractedAmount} from sender amount ${senderAmount} in transaction ${transactionId}`;
    }
  }

  logger.error(error);
  return 'Unexpected error occurred while sending transaction';
}
export function isTransferError(
  result: TransactionResultOrError,
): result is { error: true; message: string } {
  return 'error' in result;
}
