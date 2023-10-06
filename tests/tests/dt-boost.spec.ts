import { MikroORM } from '@mikro-orm/core';

import { initDataTable } from '../../src/services/data-repo.js';
import {
  getTemporaryPayoutModifier,
  setTemporaryPayoutModifier,
} from '../../src/utils/functions/dt-boost.js';
import { initORM } from '../utils/bootstrap.js';

describe('temporaryPayoutModifier', () => {
  let orm: MikroORM;
  beforeAll(async () => {
    orm = await initORM();
  });
  afterAll(async () => {
    await orm.close(true);
  });
  afterEach(async () => {
    await orm.schema.clearDatabase();
  });
  beforeEach(async () => {
    await initDataTable();
  });

  it('should return undefined if karmaBoostExpiry is not set', async () => {
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });

  it('should return undefined if karmaBoostExpiry and karmaBoostStart is in the past', async () => {
    // Arrange
    await setTemporaryPayoutModifier(2, new Date('2020-01-01'), new Date('2020-01-01'));

    // Act
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBeUndefined();
  });
  it('should return the karmaBoostModifier if karmaBoostExpiry is in the future', async () => {
    // Arrange
    const karmaBoostModifier = 2;
    // Now minus 5 minutes
    const karmaBoostStart = new Date(Date.now() - 1000 * 60 * 5);
    // Future Date = now + 1 day
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await setTemporaryPayoutModifier(karmaBoostModifier, karmaBoostStart, futureDate);
    const result = await getTemporaryPayoutModifier();

    // Assert
    expect(result).toBe(karmaBoostModifier);
  });
});
