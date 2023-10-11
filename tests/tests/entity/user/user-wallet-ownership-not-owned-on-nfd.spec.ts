import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoWallet } from '../../../../src/entities/algo-wallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/user.entity.js';
import { createNFDWalletRecords } from '../../../mocks/mock-nfd-data.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
  createRandomUser,
  createRandomWallet,
  generateAlgoWalletAddress,
  generateDiscordId,
} from '../../../utils/test-funcs.js';
jest.mock('axios');

describe('User tests that require db', () => {
  let orm: MikroORM;
  let database: EntityManager;
  let userRepo: UserRepository;
  let user: User;
  let wallet: AlgoWallet;
  let mockRequest: jest.Mock;

  beforeAll(async () => {
    orm = await initORM();
    await orm.schema.clearDatabase();
    database = orm.em.fork();
    userRepo = database.getRepository(User);
    mockRequest = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAxios as any).get = mockRequest;
    user = await createRandomUser(database);
    wallet = await createRandomWallet(database, user);
  });
  afterAll(async () => {
    await orm.close(true);
    jest.restoreAllMocks();
  });

  describe('walletOwnedByAnotherUser', () => {
    let isWalletOwnedByOtherDiscordID: boolean;
    let isWalletInvalid: boolean;
    beforeAll(() => {
      isWalletOwnedByOtherDiscordID = true;
      isWalletInvalid = true;
      // Generate the mock NFDomain data
    });

    describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
      test('should return null user because the wallet is not in the db', async () => {
        const newWallet = generateAlgoWalletAddress();
        const expectedData = createNFDWalletRecords(newWallet, undefined, generateDiscordId());
        mockRequest.mockResolvedValueOnce({ data: expectedData });

        // act
        const result = await userRepo.walletOwnedByAnotherUser(user.id, newWallet);

        // assert
        expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
        expect(result.isWalletInvalid).toBe(isWalletInvalid);

        expect(result.walletOwner).toBeNull();
      });
      test('should return user because the wallet is in the db', async () => {
        const expectedData = createNFDWalletRecords(wallet.address, undefined, generateDiscordId());
        mockRequest.mockResolvedValueOnce({ data: expectedData });

        // act
        const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

        // assert
        expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
        expect(result.isWalletInvalid).toBe(isWalletInvalid);

        expect(result.walletOwner).toBe(user);
      });
      test('should return other user because the wallets is in the db', async () => {
        const expectedData = createNFDWalletRecords(wallet.address, undefined, generateDiscordId());
        mockRequest.mockResolvedValueOnce({ data: expectedData });

        const walletOwner = await createRandomUser(database);

        // act
        const result = await userRepo.walletOwnedByAnotherUser(walletOwner.id, wallet.address);

        // assert
        expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
        expect(result.isWalletInvalid).toBe(isWalletInvalid);

        expect(result.walletOwner).not.toBe(walletOwner);
      });
    });
  });
});
