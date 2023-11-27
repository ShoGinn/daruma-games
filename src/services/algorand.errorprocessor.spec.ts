// adjust the import path as needed
import { TransactionResultOrError } from '../types/algorand.js';

import { handleTransferErrors, isTransferError } from './algorand.errorprocessor.js';

describe('handleTransferErrors', () => {
  it('should return "Insufficient funds" for insufficient funds error', () => {
    const error = new Error(
      'TransactionPool.Remember: transaction ABC123: underflow on subtracting 1000 from sender amount 500',
    );
    const result = handleTransferErrors(error);
    expect(result).toBe(
      'Insufficient funds: Tried to subtract 1000 from sender amount 500 in transaction ABC123',
    );
  });
  it('should return "Missing asset" for missing asset error', () => {
    const error = new Error('TransactionPool.Remember: transaction ABC123: asset 1 missing from 2');
    const result = handleTransferErrors(error);
    expect(result).toBe('Missing asset: Asset 1 missing from 2 in transaction ABC123');
  });
  it('should return "Unexpected error occurred while sending transaction" for other errors', () => {
    const error = new Error('Some other error');
    const result = handleTransferErrors(error);
    expect(result).toBe(
      'Unexpected error occurred while sending transaction to the network {"level":"error","logger":""}',
    );
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
