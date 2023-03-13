import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { generateAccount } from 'algosdk';
import mockAxios from 'axios';
import { inlineCode } from 'discord.js';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from '../../../src/entities/AlgoStdAsset.entity.js';
import { AlgoStdToken } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet } from '../../../src/entities/AlgoWallet.entity.js';
import { User } from '../../../src/entities/User.entity.js';
import { InternalUserIDs } from '../../../src/enums/dtEnums.js';
import { GameAssets } from '../../../src/model/logic/gameAssets.js';
import { AssetHolding, MainAssetResult } from '../../../src/model/types/algorand.js';
import { initORM } from '../../utils/bootstrap.js';
import { generateAlgoWalletAddress, generateDiscordId } from '../../utils/testFuncs.js';

jest.mock('axios');
const creatorWallet = generateAccount();

const stdAssetTemplate = {
    'current-round': '1',
    asset: {
        index: 0,
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
const KRMAAssetTemplate = {
    ...stdAssetTemplate,
    asset: {
        ...stdAssetTemplate.asset,
        index: faker.datatype.number({ min: 1_000_000_000 }),
        params: {
            ...stdAssetTemplate.asset.params,
            name: 'KRMA',
            'unit-name': 'KRMA',
            creator: creatorWallet.addr,
        },
    },
};
const ENLTAssetTemplate = {
    ...stdAssetTemplate,
    asset: {
        ...stdAssetTemplate.asset,
        index: faker.datatype.number({ min: 1_000_000_000 }),
        params: {
            ...stdAssetTemplate.asset.params,
            name: 'ENLT',
            'unit-name': 'ENLT',
            creator: creatorWallet.addr,
        },
    },
};

const fakeNFTs: MainAssetResult[] = [
    {
        index: faker.datatype.number({ min: 1_000_000_000 }),
        params: {
            creator: creatorWallet.addr,
            total: 1,
            decimals: 0,
        },
    },
    {
        index: faker.datatype.number({ min: 1_000_000_000 }),
        params: {
            creator: creatorWallet.addr,
            total: 1,
            decimals: 0,
        },
    },
];
const assetsHeld: AssetHolding[] = [
    {
        amount: 1,
        'asset-id': fakeNFTs[0].index,
        'is-frozen': false,
    },
    {
        amount: 1,
        'asset-id': fakeNFTs[1].index,
        'is-frozen': false,
    },
];
jest.mock('../../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        // returns a mock random wallet
        getCreatedAssets: jest.fn().mockReturnValue(fakeNFTs),
        updateAssetMetadata: jest.fn().mockReturnValue(0),
        generateWalletAccount: jest.fn().mockReturnValue(Math.random().toString(36).substring(7)),
        getAllStdAssets: jest.fn().mockReturnValue([]),
        getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: true, tokens: 10 }),
        lookupAssetsOwnedByAccount: jest.fn().mockReturnValue(assetsHeld),
    })),
}));

describe('setup the database', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let gameAssets: GameAssets;
    let mockRequest: jest.Mock;

    beforeAll(async () => {
        orm = await initORM();
        db = orm.em.fork();
        gameAssets = container.resolve(GameAssets);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;

        mockRequest.mockResolvedValue({ data: [] });
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
        it('should include 2 NFT assets in the database with no owners', async () => {
            const allNFT = await db.getRepository(AlgoNFTAsset).getAllRealWorldAssets();
            expect(allNFT.length).toEqual(2);
            expect(allNFT[0].creator).toHaveProperty('address', creatorWallet.addr);
            expect(allNFT[1].creator).toHaveProperty('address', creatorWallet.addr);
            expect(allNFT[0].wallet).toBeNull();
            expect(allNFT[1].wallet).toBeNull();
        });

        it('should add the standard assets', async () => {
            await db.getRepository(AlgoStdAsset).addAlgoStdAsset(KRMAAssetTemplate);
            await db.getRepository(AlgoStdAsset).addAlgoStdAsset(ENLTAssetTemplate);
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
    describe('Intent is to have a user add a wallet', () => {
        let newUser: User;
        let newUserWallets: AlgoWallet[];
        it('should add the user to the database', async () => {
            const userRepo = db.getRepository(User);
            newUser = new User(generateDiscordId());
            await userRepo.persistAndFlush(newUser);
            expect(newUser.id).toBeDefined();
            const allUsers = await userRepo.findAll();
            // should be 2 wallets because of the creator wallet
            expect(allUsers.length).toEqual(2);
        });
        it('should add a user wallet', async () => {
            const userRepo = db.getRepository(User);
            const walletAddress = generateAlgoWalletAddress();

            const msg = await userRepo.addWalletAndSyncAssets(newUser.id, walletAddress);
            expect(msg).toContain(`${inlineCode(walletAddress)} Added.`);
            expect(msg).toContain('__Added__\n2 assets');
            newUserWallets = await db
                .getRepository(AlgoWallet)
                .getAllWalletsByDiscordId(newUser.id);
            expect(newUserWallets.length).toEqual(1);
        });
        it('the 2 NFTs should now be owned by the new user', async () => {
            const allNFT = await db.getRepository(AlgoNFTAsset).getAllRealWorldAssets();
            expect(allNFT.length).toEqual(2);
            allNFT[0].wallet?.load();
            allNFT[1].wallet?.load();
            expect(allNFT[0].wallet).toHaveProperty('address', newUserWallets[0].address);
            expect(allNFT[1].wallet).toHaveProperty('address', newUserWallets[0].address);
        });
        it('there should now be 2 assets and 2 tokens in the database', async () => {
            const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
            expect(allAssets.length).toEqual(2);
            const allTokens = await db.getRepository(AlgoStdToken).findAll();
            expect(allTokens.length).toEqual(2);
            const userKRMAToken = await db
                .getRepository(AlgoStdToken)
                .getStdAssetByWallet(newUserWallets[0], KRMAAssetTemplate.asset.index);
            expect(userKRMAToken?.wallet).toHaveProperty('address', newUserWallets[0].address);
            const userENLTToken = await db
                .getRepository(AlgoStdToken)
                .getStdAssetByWallet(newUserWallets[0], ENLTAssetTemplate.asset.index);
            expect(userENLTToken?.wallet).toHaveProperty('address', newUserWallets[0].address);
        });
        describe('Run the asset sync to make sure everything is the same', () => {
            it('should sync the Users wallets', async () => {
                await db.getRepository(User).syncUserWallets(newUser.id);
            });
            it('the 2 NFTs should still be owned by the new user', async () => {
                const allNFT = await db.getRepository(AlgoNFTAsset).getAllRealWorldAssets();
                expect(allNFT.length).toEqual(2);
                allNFT[0].wallet?.load();
                allNFT[1].wallet?.load();
                expect(allNFT[0].wallet).toHaveProperty('address', newUserWallets[0].address);
                expect(allNFT[1].wallet).toHaveProperty('address', newUserWallets[0].address);
            });
            it('there should still be 2 assets and 2 tokens in the database', async () => {
                const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
                expect(allAssets.length).toEqual(2);
                const allTokens = await db.getRepository(AlgoStdToken).findAll();
                expect(allTokens.length).toEqual(2);
            });
        });

        describe('Check to see if the wallets refresh properly', () => {
            describe('Try #1', () => {
                it('attempt to add the same wallet again', async () => {
                    const userRepo = db.getRepository(User);
                    const msg = await userRepo.addWalletAndSyncAssets(
                        newUser.id,
                        newUserWallets[0].address
                    );
                    expect(msg).toContain(
                        `${inlineCode(newUserWallets[0].address)} has been refreshed.`
                    );
                    expect(msg).toContain('__Added__\n0 assets');
                    expect(msg).toContain('__Total Assets__\n2 assets');
                });
                it('the 2 NFTs should still be owned by the new user', async () => {
                    const allNFT = await db.getRepository(AlgoNFTAsset).getAllRealWorldAssets();
                    expect(allNFT.length).toEqual(2);
                    allNFT[0].wallet?.load();
                    allNFT[1].wallet?.load();
                    expect(allNFT[0].wallet).toHaveProperty('address', newUserWallets[0].address);
                    expect(allNFT[1].wallet).toHaveProperty('address', newUserWallets[0].address);
                });
                it('there should still be 2 assets and 2 tokens in the database', async () => {
                    const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
                    expect(allAssets.length).toEqual(2);
                    const allTokens = await db.getRepository(AlgoStdToken).findAll();
                    expect(allTokens.length).toEqual(2);
                });
            });
            describe('Try #2', () => {
                it('attempt to add the same wallet for the 2nd time', async () => {
                    const userRepo = db.getRepository(User);
                    const msg = await userRepo.addWalletAndSyncAssets(
                        newUser.id,
                        newUserWallets[0].address
                    );
                    expect(msg).toContain(
                        `${inlineCode(newUserWallets[0].address)} has been refreshed.`
                    );
                    expect(msg).toContain('__Added__\n0 assets');
                    expect(msg).toContain('__Total Assets__\n2 assets');
                });
                it('the 2 NFTs should still be owned by the new user', async () => {
                    const allNFT = await db.getRepository(AlgoNFTAsset).getAllRealWorldAssets();
                    expect(allNFT.length).toEqual(2);
                    allNFT[0].wallet?.load();
                    allNFT[1].wallet?.load();
                    expect(allNFT[0].wallet).toHaveProperty('address', newUserWallets[0].address);
                    expect(allNFT[1].wallet).toHaveProperty('address', newUserWallets[0].address);
                });

                it('there should still be 2 assets and 2 tokens in the database', async () => {
                    const allAssets = await db.getRepository(AlgoStdAsset).getAllStdAssets();
                    expect(allAssets.length).toEqual(2);
                    const allTokens = await db.getRepository(AlgoStdToken).findAll();
                    expect(allTokens.length).toEqual(2);
                });
            });
        });
    });
});
