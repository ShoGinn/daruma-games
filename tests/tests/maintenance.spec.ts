import { isInMaintenance, setMaintenance } from '../../src/utils/functions/maintenance.js';
jest.mock('../../src/entities/data.mongo.js', () => ({
  getData: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
  setData: jest.fn(),
}));
describe('Maintenance Functions', () => {
  test('checks if the bot is in maintenance mode', async () => {
    const isMX = await isInMaintenance();
    expect(isMX).toBe(false);
  });
  test('sets the bot in maintenance mode', async () => {
    await setMaintenance(true);
    const isMX = await isInMaintenance();
    expect(isMX).toBe(true);
  });
});
