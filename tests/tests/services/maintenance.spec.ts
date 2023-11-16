/* eslint-disable @typescript-eslint/unbound-method */
import { AppStateRepository } from '../../../src/database/app-state/app-state.repo.js';
import { MaintenanceService } from '../../../src/services/maintenance.js';
import logger from '../../../src/utils/functions/logger-factory.js';

jest.mock('../../../src/utils/functions/logger-factory.js');

describe('MaintenanceService', () => {
  let maintenanceService: MaintenanceService;
  let mockAppStateRepository: jest.Mocked<AppStateRepository>;

  beforeEach(() => {
    mockAppStateRepository = {
      readData: jest.fn(),
      writeData: jest.fn(),
    } as unknown as jest.Mocked<AppStateRepository>;
    maintenanceService = new MaintenanceService(mockAppStateRepository);
  });

  describe('isInMaintenance', () => {
    it('should return the maintenance state', async () => {
      const maintenanceState = true;
      mockAppStateRepository.readData.mockResolvedValue(maintenanceState);

      const result = await maintenanceService.isInMaintenance();

      expect(result).toBe(maintenanceState);
      expect(mockAppStateRepository.readData).toHaveBeenCalledWith('maintenance');
    });
  });

  describe('setMaintenance', () => {
    it('should set the maintenance state and log the change', async () => {
      const maintenanceState = true;

      await maintenanceService.setMaintenance(maintenanceState);

      expect(mockAppStateRepository.writeData).toHaveBeenCalledWith(
        'maintenance',
        maintenanceState,
      );
      expect(logger.info).toHaveBeenCalledWith(`Maintenance mode: ${maintenanceState}`);
    });
  });
});
