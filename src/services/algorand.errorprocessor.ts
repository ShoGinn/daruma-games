import { TransactionResultOrError } from '../types/algorand.js';
import logger from '../utils/functions/logger-factory.js';

export function handleTransferErrors(error: unknown): string {
  const insufficientFundsError =
    /TransactionPool\.Remember: transaction [\dA-Z]+: underflow on subtracting \d+ from sender amount \d+/g;
  if (error instanceof Error && insufficientFundsError.test(error.message)) {
    return 'Insufficient funds';
  }
  logger.error(error);
  return 'Unexpected error occurred while sending transaction';
}

export function isTransferError(
  result: TransactionResultOrError,
): result is { error: true; message: string } {
  return 'error' in result;
}
