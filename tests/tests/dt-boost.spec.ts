import { getData } from '../../src/entities/data.mongo.js';
import {
  getTemporaryPayoutModifier,
  setTemporaryPayoutModifier,
} from '../../src/utils/functions/dt-boost.js';

jest.mock('../../src/entities/data.mongo.js', () => ({
  getData: jest.fn(),
  setData: jest.fn(),
}));
const getDataMock = getData as jest.Mock;

describe('getTemporaryPayoutModifier', () => {
  test('should return the karma boost modifier when the boost is active', async () => {
    // Arrange
    getDataMock
      .mockResolvedValueOnce(new Date(Date.now() - 1000 * 60 * 60))
      .mockResolvedValueOnce(new Date(Date.now() + 1000 * 60 * 60))
      .mockResolvedValueOnce(1.5);
    const karmaBoostModifier = 1.5;
    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBe(karmaBoostModifier);
  });

  test('should return nothing when the dataTable is empty', async () => {
    // Arrange

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });
  test('should return undefined if karmaBoostExpiry and karmaBoostStart is in the past', async () => {
    // Arrange
    const date = new Date('2020-01-01');
    const modifier = 1.5;
    getDataMock
      .mockResolvedValueOnce(date)
      .mockResolvedValueOnce(date)
      .mockResolvedValueOnce(modifier);

    await setTemporaryPayoutModifier(modifier, date, date);

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });
});
