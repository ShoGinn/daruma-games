/* eslint-disable @typescript-eslint/unbound-method */
import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import logger from '../utils/functions/logger-factory.js';

import { MaintenanceService } from './maintenance.js';

describe('MaintenanceService', () => {
  let maintenanceService: MaintenanceService;
  let mockAppStateRepository: jest.Mocked<AppStateRepository>;
  let loggerSpyInfo;

  beforeEach(() => {
    loggerSpyInfo = jest.spyOn(logger, 'info').mockImplementation();
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
      expect(loggerSpyInfo).toHaveBeenCalledWith(`Maintenance mode: ${maintenanceState}`);
    });
  });
});
