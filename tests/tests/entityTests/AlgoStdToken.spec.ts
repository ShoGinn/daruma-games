import { EntityManager, MikroORM } from '@mikro-orm/core';

import { AlgoStdAsset } from '../../../src/entities/AlgoStdAsset.entity.js';
import { AlgoStdToken, AlgoStdTokenRepository } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet } from '../../../src/entities/AlgoWallet.entity.js';
import { User } from '../../../src/entities/User.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomASA, createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';
jest.mock('../../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        getTokenOptInStatus: jest
            .fn()
            .mockResolvedValueOnce({ optedIn: undefined, tokens: undefined }),
    })),
}));
describe('Validate the getTokenFromAlgoNetwork function', () => {
    it('should return the token opted in and tokens', async () => {
        const orm = await initORM();
        const database = orm.em.fork();
        const tokenRepo = database.getRepository(AlgoStdToken);
        const randomASA = await createRandomASA(database);
        const randomUser = await createRandomUser(database);
        const randomWallet = await createRandomWallet(database, randomUser);
        const token = await tokenRepo.getTokenFromAlgoNetwork(randomWallet, randomASA);
        expect(token).toEqual({ optedIn: undefined, tokens: undefined });
        await orm.close(true);
    });
});
describe('asset tests that require db', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let tokenRepo: AlgoStdTokenRepository;
    let randomASA: AlgoStdAsset;
    let randomWallet: AlgoWallet;
    let randomUser: User;
    let getTokenFromAlgoNetwork: jest.SpyInstance;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        database = orm.em.fork();
        refreshRepos();
        randomASA = await createRandomASA(database);
        randomUser = await createRandomUser(database);
        randomWallet = await createRandomWallet(database, randomUser);
        getTokenFromAlgoNetwork = jest.spyOn(tokenRepo, 'getTokenFromAlgoNetwork');
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    function refreshRepos(): void {
        database = orm.em.fork();
        tokenRepo = database.getRepository(AlgoStdToken);
        getTokenFromAlgoNetwork = jest.spyOn(tokenRepo, 'getTokenFromAlgoNetwork');
    }
    describe('addAlgoStdToken', () => {
        it('should add the token to the user wallet with defaults', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });
        it('should handle if the algo network returns undefined', async () => {
            expect.assertions(1);
            getTokenFromAlgoNetwork.mockResolvedValueOnce({
                optedIn: undefined,
                tokens: undefined,
            });
            try {
                await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            } catch (error) {
                expect(error).toHaveProperty(
                    'message',
                    'Invalid type passed to convertBigIntToNumber'
                );
            }
        });
        it('should update tokens because the token already exists', async () => {
            let allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(0);

            // Add the token
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });

            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);

            allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(1);

            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
            // add another token which should just be an update
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 2 }); // act

            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);

            allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(1);

            expect(tokenUpdated?.tokens).toEqual(2);
            expect(tokenUpdated?.optedIn).toEqual(true);
            expect(tokenUpdated?.wallet).toEqual(randomWallet);
        });

        it('should add the token to a wallet that already has the ASA', async () => {
            let allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(0);

            randomWallet.asa.add(randomASA);
            await database.persistAndFlush(randomWallet);
            refreshRepos();
            allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(0);

            expect(randomWallet.asa.count()).toEqual(1);
            expect(randomWallet.tokens.count()).toEqual(0);
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            allTokens = await tokenRepo.findAll();
            expect(allTokens).toHaveLength(1);

            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(randomWallet.asa.count()).toEqual(1);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });

        it('should add the token to the user wallet when the ASA has bigInt', async () => {
            randomASA.decimals = 8;
            await database.persistAndFlush(randomASA);
            refreshRepos();
            getTokenFromAlgoNetwork.mockResolvedValueOnce({
                optedIn: true,
                tokens: BigInt(1_431_400_000_000),
            }); // act
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(14_314);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });

        it('should add the token to the user wallet and set not opted in', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: false, tokens: 1 }); // act
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(false);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });
    });
    describe('getAllAssetsByWalletWithUnclaimedTokens', () => {
        it('should return an empty array if the wallet has no tokens', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            const tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens).toHaveLength(0);
        });
        it('should return an array of tokens if the wallet has tokens', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: false, tokens: 1 }); // act
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens).toHaveLength(1);
        });
        it('should return an array of 2 tokens if the wallet has tokens', async () => {
            getTokenFromAlgoNetwork.mockResolvedValue({ optedIn: false, tokens: 1 }); // act
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            let tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            // add another asa to the db then add tokens to it
            const randomASA2 = await createRandomASA(database);
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA2);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA2.id, 1);
            tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens).toHaveLength(2);
        });
    });
    describe('isWalletWithAssetOptedIn', () => {
        it('should return false if the wallet does not have the token', async () => {
            const isOptedIn = await tokenRepo.isWalletWithAssetOptedIn(randomWallet, randomASA.id);
            expect(isOptedIn).toEqual(false);
        });
        it('should return false if the wallet has the token but is not opted in', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: false, tokens: 1 }); // act
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const isOptedIn = await tokenRepo.isWalletWithAssetOptedIn(randomWallet, randomASA.id);
            expect(isOptedIn).toEqual(false);
        });
        it('should return true if the wallet has the token and is opted in', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const isOptedIn = await tokenRepo.isWalletWithAssetOptedIn(randomWallet, randomASA.id);
            expect(isOptedIn).toEqual(true);
        });
    });
    describe('getWalletWithUnclaimedTokens', () => {
        it('should return null if the wallet does not have the token', async () => {
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens).toBeNull();
        });
        it('should return null if the wallet has the token but has no unclaimed tokens', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens).toBeNull();
        });
        it('should return true if the wallet has the token and has unclaimed tokens', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await database.persistAndFlush(token!);
            refreshRepos();
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toHaveProperty('address', randomWallet.address);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
        });
    });
    describe('removeUnclaimedTokens', () => {
        it('should remove the unclaimed tokens from the wallet', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await database.persistAndFlush(token!);
            refreshRepos();
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toHaveProperty('address', randomWallet.address);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
            await tokenRepo.removeUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenUpdated?.unclaimedTokens).toEqual(0);
        });
    });
    describe('addUnclaimedTokens', () => {
        it('should add the unclaimed tokens to the wallet', async () => {
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1 });
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await database.persistAndFlush(token!);
            refreshRepos();
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toHaveProperty('address', randomWallet.address);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenUpdated?.unclaimedTokens).toEqual(2);
        });
        it('should return 0 if the wallet does not have the token', async () => {
            try {
                await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            } catch (error) {
                expect(error).toHaveProperty(
                    'message',
                    `Wallet does not have asset: ${randomASA.id}`
                );
            }
        });
    });
});
