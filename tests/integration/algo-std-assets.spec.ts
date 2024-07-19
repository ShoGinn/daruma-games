import * as algokit from '@algorandfoundation/algokit-utils';
import * as algotesting from '@algorandfoundation/algokit-utils/testing';
import { Account, secretKeyToMnemonic } from 'algosdk';
import { container } from 'tsyringe';

import { AlgoStdAssetsService } from '../../src/services/algo-std-assets.js';
import { RewardsService } from '../../src/services/rewards.js';
import { UserService } from '../../src/services/user.js';
import { DiscordId } from '../../src/types/core.js';
import { setupMongo } from '../fixtures/mongodb-fixture.js';

import { generateTestAsset } from './_asset.js';

jest.unmock('axios');
// These tests are for the end to end flow of the Algorand Standard Asset
// It is not intended at this time to run these tests in CI
describe('Algorand Standard Asset End to End Tests', () => {
  if (process.env['RUN_E2E_TESTS'] === 'true') {
    describe('Algorand Standard Asset End to End Tests', () => {
      const localnet = algotesting.algorandFixture();
      let karmaAssetId: number;
      let enlightenmentAssetId: number;
      let claimAccount: Account;
      let clawbackAccount: Account;
      let userAccount: Account;
      const userDiscordId = '123456789' as DiscordId;
      let userAccount2: Account;
      const user2DiscordId = '987654321' as DiscordId;
      beforeAll(async () => {
        await setupMongo();
      });
      beforeEach(localnet.beforeEach, 10e6);
      test('should create the claim and clawback accounts', async () => {
        const { algod, testAccount, generateAccount } = localnet.context;
        clawbackAccount = testAccount;
        claimAccount = await generateAccount({ initialFunds: (1).algos() });
        const claimAccountInfo = await algod.accountInformation(claimAccount.addr).do();
        expect(claimAccountInfo['amount']).toBe(1_000_000);
        // set the environment for the clawback and claim tokens using the accounts to generate the mnemonic
        process.env['CLAWBACK_TOKEN_MNEMONIC'] = secretKeyToMnemonic(clawbackAccount.sk);
        process.env['CLAIM_TOKEN_MNEMONIC'] = secretKeyToMnemonic(claimAccount.sk);
      }, 10e6);
      test('should create the game assets', async () => {
        const { algod, transactionLogger, indexer } = localnet.context;
        karmaAssetId = await generateTestAsset(algod, clawbackAccount, 1_000_000);
        enlightenmentAssetId = await generateTestAsset(algod, clawbackAccount, 1_000_000);
        await algokit.assetBulkOptIn(
          { account: claimAccount, assetIds: [karmaAssetId, enlightenmentAssetId] },
          algod,
        );
        await algokit.transferAsset(
          {
            from: clawbackAccount,
            to: claimAccount.addr,
            assetId: karmaAssetId,
            amount: 100_000,
          },
          algod,
        );
        await algokit.transferAsset(
          {
            from: clawbackAccount,
            to: claimAccount.addr,
            assetId: enlightenmentAssetId,
            amount: 100_000,
          },
          algod,
        );
        await transactionLogger.waitForIndexer(indexer);
        const claimAccountInfoKarma = await algod
          .accountAssetInformation(claimAccount.addr, karmaAssetId)
          .do();
        expect(claimAccountInfoKarma['asset-holding'].amount).toBe(100_000);
        const claimAccountInfoEnlightenment = await algod
          .accountAssetInformation(claimAccount.addr, enlightenmentAssetId)
          .do();
        expect(claimAccountInfoEnlightenment['asset-holding'].amount).toBe(100_000);
      }, 10e6);
      test('should add both assets into the game', async () => {
        const algoStdAssetService = container.resolve(AlgoStdAssetsService);

        const result1 = await algoStdAssetService.addAlgoStdAsset(karmaAssetId);
        expect(result1._id).toBe(karmaAssetId);
        const result2 = await algoStdAssetService.addAlgoStdAsset(enlightenmentAssetId);
        expect(result2._id).toBe(enlightenmentAssetId);
      });
      test('should create 2 user wallets, opt into the assets', async () => {
        const { algod, transactionLogger, indexer, generateAccount } = localnet.context;
        userAccount = await generateAccount({ initialFunds: (1).algos() });
        userAccount2 = await generateAccount({ initialFunds: (1).algos() });
        await algokit.assetBulkOptIn(
          { account: userAccount, assetIds: [karmaAssetId, enlightenmentAssetId] },
          algod,
        );
        await algokit.assetBulkOptIn(
          { account: userAccount2, assetIds: [karmaAssetId, enlightenmentAssetId] },
          algod,
        );
        await transactionLogger.waitForIndexer(indexer);
        const userAccountInfoKarma = await algod
          .accountAssetInformation(userAccount.addr, karmaAssetId)
          .do();
        expect(userAccountInfoKarma['asset-holding'].amount).toBe(0);
        const userAccountInfoEnlightenment = await algod
          .accountAssetInformation(userAccount.addr, enlightenmentAssetId)
          .do();
        expect(userAccountInfoEnlightenment['asset-holding'].amount).toBe(0);
      });
      test('should add the algo wallets to the database users', async () => {
        const userService = container.resolve(UserService);

        const user = await userService.addWalletToUser(userAccount.addr, userDiscordId);
        expect(user).toBe(`Wallet: ${userAccount.addr} added to Discord account: ${userDiscordId}`);
        const user2 = await userService.addWalletToUser(userAccount2.addr, user2DiscordId);
        expect(user2).toBe(
          `Wallet: ${userAccount2.addr} added to Discord account: ${user2DiscordId}`,
        );
      });
      test('use the admin command to seed the wallets', async () => {
        const { transactionLogger, indexer, algod } = localnet.context;
        const rewardsService = container.resolve(RewardsService);
        await rewardsService.dispenseAssetToUser(karmaAssetId, 10_000, userAccount.addr);
        await rewardsService.dispenseAssetToUser(karmaAssetId, 10_000, userAccount2.addr);
        await transactionLogger.waitForIndexer(indexer);
        const userAccountKarma = await algod
          .accountAssetInformation(userAccount.addr, karmaAssetId)
          .do();
        expect(userAccountKarma['asset-holding'].amount).toBe(10_000);
        const user2AccountKarma = await algod
          .accountAssetInformation(userAccount2.addr, karmaAssetId)
          .do();
        expect(user2AccountKarma['asset-holding'].amount).toBe(10_000);
      });
      test('add temporary tokens to both users and do a bulk claim', async () => {
        const rewardsService = container.resolve(RewardsService);
        const stdAssetService = container.resolve(AlgoStdAssetsService);
        const { transactionLogger, indexer, algod } = localnet.context;
        const optedIn1 = await rewardsService.issueTemporaryTokens(
          userDiscordId,
          userAccount.addr,
          karmaAssetId,
          1000,
        );
        const optedin2 = await rewardsService.issueTemporaryTokens(
          user2DiscordId,
          userAccount2.addr,
          karmaAssetId,
          1000,
        );
        expect(optedIn1).toBe(1000);
        expect(optedin2).toBe(1000);
        const karmaAsset = await stdAssetService.getStdAssetByAssetIndex(karmaAssetId);
        const walletsWithUnclaimedAssets = await rewardsService.fetchWalletsWithUnclaimedAssets(
          1,
          karmaAsset,
        );
        await rewardsService.batchTransActionProcessor(walletsWithUnclaimedAssets, karmaAsset);
        await transactionLogger.waitForIndexer(indexer);
        const userAccountKarma = await algod
          .accountAssetInformation(userAccount.addr, karmaAssetId)
          .do();
        expect(userAccountKarma['asset-holding'].amount).toBe(11_000);
        const user2AccountKarma = await algod
          .accountAssetInformation(userAccount2.addr, karmaAssetId)
          .do();
        expect(user2AccountKarma['asset-holding'].amount).toBe(11_000);
      });
    });
  } else {
    test('skipping Algorand Standard Asset End to End Tests', () => {
      expect(true).toBeTruthy();
    });
  }
});
