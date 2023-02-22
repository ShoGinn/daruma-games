import { EntityManager, MikroORM } from '@mikro-orm/core';

import { AlgoStdAsset } from '../../../src/entities/AlgoStdAsset.entity.js';
import { AlgoStdToken, AlgoStdTokenRepository } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet } from '../../../src/entities/AlgoWallet.entity.js';
import { User } from '../../../src/entities/User.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomASA, createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let tokenRepo: AlgoStdTokenRepository;
    let randomASA: AlgoStdAsset;
    let randomWallet: AlgoWallet;
    let randomUser: User;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        tokenRepo = db.getRepository(AlgoStdToken);
        randomASA = await createRandomASA(db);
        randomUser = await createRandomUser(db);
        randomWallet = await createRandomWallet(randomUser, db);
    });

    describe('addAlgoStdToken', () => {
        it('should add the token to the user wallet with defaults', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });
        it('should update tokens because the token already exists', async () => {
            let allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(0);

            // Add the token
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);

            allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(1);

            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
            // add another token which should just be an update
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 2, true);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);

            allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(1);

            expect(tokenUpdated?.tokens).toEqual(2);
            expect(tokenUpdated?.optedIn).toEqual(true);
            expect(tokenUpdated?.wallet).toEqual(randomWallet);
        });

        it('should add the token to a wallet that already has the ASA', async () => {
            let allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(0);

            randomWallet.asa.add(randomASA);
            await db.persistAndFlush(randomWallet);

            allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(0);

            expect(randomWallet.asa.count()).toEqual(1);
            expect(randomWallet.tokens.count()).toEqual(0);

            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            allTokens = await tokenRepo.findAll();
            expect(allTokens.length).toEqual(1);

            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(randomWallet.asa.count()).toEqual(1);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });

        it('should add the token to the user wallet when the ASA has bigInt', async () => {
            randomASA.decimals = 8;
            await db.persistAndFlush(randomASA);
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, BigInt(1431400000000), true);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(14314);
            expect(tokenAdded?.optedIn).toEqual(true);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });

        it('should add the token to the user wallet and set not opted in', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, false);
            const tokenAdded = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenAdded?.tokens).toEqual(1);
            expect(tokenAdded?.optedIn).toEqual(false);
            expect(tokenAdded?.wallet).toEqual(randomWallet);
        });
    });
    describe('getAllAssetsByWalletWithUnclaimedTokens', () => {
        it('should return an empty array if the wallet has no tokens', async () => {
            const tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens.length).toEqual(0);
        });
        it('should return an array of tokens if the wallet has tokens', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, false);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens.length).toEqual(1);
        });
        it('should return an array of 2 tokens if the wallet has tokens', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, false);
            let tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            // add another asa to the db then add tokens to it
            const randomASA2 = await createRandomASA(db);
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA2, 1, false);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA2.id, 1);
            tokens = await tokenRepo.getAllAssetsByWalletWithUnclaimedTokens(randomWallet);
            expect(tokens.length).toEqual(2);
        });
    });
    describe('isWalletWithAssetOptedIn', () => {
        it('should return false if the wallet does not have the token', async () => {
            const isOptedIn = await tokenRepo.isWalletWithAssetOptedIn(randomWallet, randomASA.id);
            expect(isOptedIn).toEqual(false);
        });
        it('should return false if the wallet has the token but is not opted in', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, false);
            const isOptedIn = await tokenRepo.isWalletWithAssetOptedIn(randomWallet, randomASA.id);
            expect(isOptedIn).toEqual(false);
        });
        it('should return true if the wallet has the token and is opted in', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
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
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens).toBeNull();
        });
        it('should return true if the wallet has the token and has unclaimed tokens', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await db.persistAndFlush(token!);
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toEqual(randomWallet);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
        });
    });
    describe('removeUnclaimedTokens', () => {
        it('should remove the unclaimed tokens from the wallet', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await db.persistAndFlush(token!);
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toEqual(randomWallet);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
            await tokenRepo.removeUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenUpdated?.unclaimedTokens).toEqual(0);
        });
    });
    describe('addUnclaimedTokens', () => {
        it('should add the unclaimed tokens to the wallet', async () => {
            await tokenRepo.addAlgoStdToken(randomWallet, randomASA, 1, true);
            const token = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(token).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            token!.unclaimedTokens = 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await db.persistAndFlush(token!);
            const hasUnclaimedTokens = await tokenRepo.getWalletWithUnclaimedTokens(
                randomWallet,
                randomASA.id
            );
            expect(hasUnclaimedTokens?.wallet).toEqual(randomWallet);
            expect(hasUnclaimedTokens?.tokens).toEqual(1);
            await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            const tokenUpdated = await tokenRepo.getStdAssetByWallet(randomWallet, randomASA.id);
            expect(tokenUpdated?.unclaimedTokens).toEqual(2);
        });
        it('should return 0 if the wallet does not have the token', async () => {
            try {
                await tokenRepo.addUnclaimedTokens(randomWallet, randomASA.id, 1);
            } catch (e) {
                expect(e).toHaveProperty('message', `Wallet does not have asset: ${randomASA.id}`);
            }
        });
    });
});
