import { EntityManager, MikroORM } from '@mikro-orm/core';
import { generateAccount } from 'algosdk';
import { container } from 'tsyringe';

import { AlgoStdAsset } from '../../../src/entities/AlgoStdAsset.entity.js';
import { AlgoWallet } from '../../../src/entities/AlgoWallet.entity.js';
import { InternalUserIDs } from '../../../src/enums/dtEnums.js';
import { GameAssets } from '../../../src/model/logic/gameAssets.js';
import { initORM } from '../../utils/bootstrap.js';
jest.mock('../../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        // returns a mock random wallet
        getCreatedAssets: jest.fn().mockReturnValue([]),
        updateAssetMetadata: jest.fn().mockReturnValue(0),
        generateWalletAccount: jest.fn().mockReturnValue(Math.random().toString(36).substring(7)),
        getAllStdAssets: jest.fn().mockReturnValue([]),
        getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
        lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
    })),
}));

describe('setup the database', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let gameAssets: GameAssets;
    const creatorWallet = generateAccount();

    const assetTemplate = {
        'current-round': '1',
        asset: {
            index: 1,
            'created-at-round': 1,
            'deleted-at-round': 0,
            params: {
                name: 'template',
                'unit-name': 'template',
                creator: 'creator',
                decimals: 0,
                total: 1,
            },
        },
    };

    beforeAll(async () => {
        orm = await initORM();
        db = orm.em.fork();
        gameAssets = container.resolve(GameAssets);
    });
    afterAll(async () => {
        await orm.close(true);
    });

    describe('Intent is to test the adding of 1 creator wallet and the 2 game assets', () => {
        it('Game assets should not be ready', () => {
            expect(gameAssets.isReady()).toBeFalsy();
        });
        it('should add a creator wallet', async () => {
            const dbWallet = await db
                .getRepository(AlgoWallet)
                .addCreatorWallet(creatorWallet.addr);
            expect(dbWallet?.address).toEqual(creatorWallet.addr);
        });
        it('should add the standard assets', async () => {
            const KRMA = assetTemplate;
            KRMA.asset.params.name = 'KRMA';
            KRMA.asset.params['unit-name'] = 'KRMA';
            KRMA.asset.params.creator = creatorWallet.addr;
            await db.getRepository(AlgoStdAsset).addAlgoStdAsset(KRMA);

            const ENLT = assetTemplate;
            ENLT.asset.params.name = 'ENLT';
            ENLT.asset.params['unit-name'] = 'ENLT';
            ENLT.asset.params.creator = creatorWallet.addr;
            ENLT.asset.index = 2;
            await db.getRepository(AlgoStdAsset).addAlgoStdAsset(ENLT);
            const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
            expect(allAssets.length).toEqual(2);
        });
        it('Game assets should not be ready until init', async () => {
            expect(gameAssets.isReady()).toBeFalsy();
            await gameAssets.initAll();
            expect(gameAssets.isReady()).toBeTruthy();
        });
        it('should make sure the database has all the items created', async () => {
            const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
            expect(allAssets.length).toEqual(2);
            const allWallets = await db
                .getRepository(AlgoWallet)
                .getAllWalletsAndAssetsByDiscordId(InternalUserIDs.creator.toString());
            expect(allWallets.length).toEqual(1);
        });
    });
});
