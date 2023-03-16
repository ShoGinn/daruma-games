import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { GameStatus, GameTypes } from '../../src/enums/daruma-training.js';
import { initORM } from '../utils/bootstrap.js';
import { createRandomGame } from '../utils/test-funcs.js';
jest.mock('../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        // returns a mock random wallet
        getCreatedAssets: jest.fn().mockReturnValue([]),
        updateAssetMetadata: jest.fn().mockReturnValue(0),
        createFakeWallet: jest.fn().mockReturnValue(Math.random().toString(36).slice(7)),
        getAllStdAssets: jest.fn().mockReturnValue([]),
        getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
        lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
    })),
}));

describe('The Player class', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let client: Client;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(() => {
        database = orm.em.fork();
        client = container.resolve(Client);
    });
    afterEach(async () => {
        await orm.schema.clearDatabase();
    });
    describe('check the game starting status', () => {
        it('should return false if the game has not started', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            expect(oneVsNpc.getNPC).toEqual({
                assetIndex: 1,
                gameType: 'OneVsNpc',
                name: 'Karasu',
            });
            expect(oneVsNpc.getPlayer('fakeName')).toEqual(undefined);
            expect(oneVsNpc.getPlayerIndex('fakeName')).toEqual(-1);
            expect(oneVsNpc.playerCount).toEqual(0);
            expect(oneVsNpc.playerArray).toEqual([]);
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
        });
    });
});
