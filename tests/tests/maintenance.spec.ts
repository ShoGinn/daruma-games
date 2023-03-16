import { MikroORM } from '@mikro-orm/core';

import { initDataTable } from '../../src/services/data-repo.js';
import { isInMaintenance, setMaintenance } from '../../src/utils/functions/maintenance.js';
import { initORM } from '../utils/bootstrap.js';

describe('Maintenance Functions', () => {
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
    it('checks if the bot is in maintenance mode', async () => {
        const isMX = await isInMaintenance();
        expect(isMX).toBe(false);
    });
    it('sets the bot in maintenance mode', async () => {
        await setMaintenance(true);
        const isMX = await isInMaintenance();
        expect(isMX).toBe(true);
    });
    it('sets the bot out of maintenance mode', async () => {
        let isMX = await isInMaintenance();
        expect(isMX).toBe(false);
        await setMaintenance(true);
        isMX = await isInMaintenance();
        expect(isMX).toBe(true);
        await setMaintenance(false);
        isMX = await isInMaintenance();
        expect(isMX).toBe(false);
    });
});
