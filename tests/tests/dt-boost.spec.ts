import { container } from 'tsyringe';

import {
  getTemporaryPayoutModifier,
  setTemporaryPayoutModifier,
} from '../../src/utils/functions/dt-boost.js';
jest.mock('tsyringe');
describe('getTemporaryPayoutModifier', () => {
  test('should return the karma boost modifier when the boost is active', async () => {
    // Arrange
    const karmaBoostStartString = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const karmaBoostExpiryString = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour from now
    const karmaBoostModifier = 1.5;

    const dataRepositoryMock = {
      get: jest
        .fn()
        .mockResolvedValueOnce(karmaBoostStartString)
        .mockResolvedValueOnce(karmaBoostExpiryString)
        .mockResolvedValueOnce(karmaBoostModifier),
    };

    const emMock = {
      fork: jest.fn().mockReturnValueOnce({
        getRepository: jest.fn().mockReturnValueOnce(dataRepositoryMock),
      }),
    };

    const mikroORMMock = {
      em: emMock,
    };

    jest.spyOn(container, 'resolve').mockReturnValueOnce(mikroORMMock);

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBe(karmaBoostModifier);
  });

  test('should return nothing when the dataTable is empty', async () => {
    // Arrange
    const dataRepositoryMock = {
      get: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };

    const emMock = {
      fork: jest.fn().mockReturnValueOnce({
        getRepository: jest.fn().mockReturnValueOnce(dataRepositoryMock),
      }),
    };

    const mikroORMMock = {
      em: emMock,
    };

    jest.spyOn(container, 'resolve').mockReturnValueOnce(mikroORMMock);

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });
  test('should return undefined if karmaBoostExpiry is not set', async () => {
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });

  test('should return undefined if karmaBoostExpiry and karmaBoostStart is in the past', async () => {
    // Arrange
    const karmaBoostStartString = new Date('2020-01-01');
    const karmaBoostExpiryString = new Date('2020-01-01');
    const karmaBoostModifier = 1.5;

    const dataRepositoryMock = {
      get: jest
        .fn()
        .mockResolvedValueOnce(karmaBoostStartString)
        .mockResolvedValueOnce(karmaBoostExpiryString)
        .mockResolvedValueOnce(karmaBoostModifier),
      set: jest.fn(),
    };

    const emMock = {
      fork: jest.fn().mockReturnValueOnce({
        getRepository: jest.fn().mockReturnValueOnce(dataRepositoryMock),
      }),
    };

    const mikroORMMock = {
      em: emMock,
    };

    jest.spyOn(container, 'resolve').mockReturnValueOnce(mikroORMMock);

    await setTemporaryPayoutModifier(
      karmaBoostModifier,
      karmaBoostStartString,
      karmaBoostExpiryString,
    );

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });
});
