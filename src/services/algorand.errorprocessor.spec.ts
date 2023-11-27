// adjust the import path as needed
import { TransactionResultOrError } from '../types/algorand.js';

import { handleTransferErrors, isTransferError } from './algorand.errorprocessor.js';

describe('handleTransferErrors', () => {
  it('should return "Insufficient funds" for insufficient funds error', () => {
    const error = new Error(
      'TransactionPool.Remember: transaction ABC123: underflow on subtracting 1000 from sender amount 500',
    );
    const result = handleTransferErrors(error);
    expect(result).toBe('Insufficient funds');
  });

  it('should return "Unexpected error occurred while sending transaction" for other errors', () => {
    const error = new Error('Some other error');
    const result = handleTransferErrors(error);
    expect(result).toBe('Unexpected error occurred while sending transaction');
  });
});

describe('isTransferError', () => {
  it('should return true for transfer errors', () => {
    const result = { error: true, message: 'Insufficient funds' } as TransactionResultOrError;
    expect(isTransferError(result)).toBe(true);
  });

  it('should return false for successful transactions', () => {
    const result = { transaction: { txID: () => 'ABC123' } } as TransactionResultOrError;
    expect(isTransferError(result)).toBe(false);
  });
});
