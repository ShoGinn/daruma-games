import { generateAccount, secretKeyToMnemonic } from 'algosdk';
import { container } from 'tsyringe';

import { clearSystemPropertyCache } from '../../src/model/framework/decorators/SystemProperty.js';
import { Algorand } from '../../src/services/Algorand.js';

describe('Algorand service tests', () => {
    let algorand: Algorand;
    const OLD_ENV = process.env;

    beforeAll(() => {
        process.env.CLAWBACK_TOKEN_MNEMONIC = 'test';
        algorand = container.resolve(Algorand);
    });
    beforeEach(() => {
        clearSystemPropertyCache();
        process.env = { ...OLD_ENV };
    });
    afterEach(() => {
        process.env = OLD_ENV;
    });

    describe('noteToArc69Payload', () => {
        it('should return undefined if note is null or undefined', () => {
            let arc69 = algorand.noteToArc69Payload(null);
            expect(arc69).toBeUndefined();
            arc69 = algorand.noteToArc69Payload();
            expect(arc69).toBeUndefined();
        });
        it('should convert note to arc69 payload', () => {
            const assetNote = {
                note: 'eyJzdGFuZGFyZCI6ImFyYzY5IiwibWltZV90eXBlIjoiaW1hZ2UvcG5nIiwiZGVzY3JpcHRpb24iOiJBbGdvRGFydW1hICMxIEdpdmVhd2F5ISIsInByb3BlcnRpZXMiOnsiQWNjZXNzb3J5IChCYWNrKSI6IkNvbW1vbiAtIEdvb2QgTHVjayBTdGljayIsIkFjY2Vzc29yeSAoSGVhZCkiOiJDb21tb24gLSBIb3JuIiwiQm9keSBEZXNpZ24iOiJVbmNvbW1vbiAtIEdvbGQgRGVzaWduIiwiRmFjZSBDb2xvciI6IlJhcmUgLSBHb2xkIEZhY2UiLCJFeWUgQWNjZXNzb3JpZXMiOiJFcGljIC0gTXVtbXkgV3JhcC9FeWUiLCJCYWNrZ3JvdW5kIChCRykiOiJVbmNvbW1vbiAtIEJHICsgQkcgRGVzaWduIn19',
            };
            const arc69 = algorand.noteToArc69Payload(assetNote.note);
            expect(arc69).toEqual({
                standard: 'arc69',
                description: 'AlgoDaruma #1 Giveaway!',
                mime_type: 'image/png',
                properties: {
                    'Accessory (Back)': 'Common - Good Luck Stick',
                    'Accessory (Head)': 'Common - Horn',
                    'Background (BG)': 'Uncommon - BG + BG Design',
                    'Body Design': 'Uncommon - Gold Design',
                    'Eye Accessories': 'Epic - Mummy Wrap/Eye',
                    'Face Color': 'Rare - Gold Face',
                },
            });
        });
        it('should return undefined if note is not a valid arc69 payload', () => {
            const encoded: string = Buffer.from('test string', 'utf8').toString('base64');
            const arc69 = algorand.noteToArc69Payload(encoded);
            expect(arc69).toBeUndefined();
        });
    });
    describe('validateWalletAddress / generateWalletAccount', () => {
        it('should return false because the wallet is invalid', () => {
            const valid = algorand.validateWalletAddress('test');
            expect(valid).toBeFalsy();
        });
        it('should create a fake wallet return true because the wallet is valid', () => {
            const validWallet = algorand.generateWalletAccount();
            const valid = algorand.validateWalletAddress(validWallet);
            expect(valid).toBeTruthy();
        });
    });
    describe('getAccountFromMnemonic', () => {
        it('should return undefined if the string is not valid', () => {
            const account = algorand.getAccountFromMnemonic(' ');
            expect(account).toBeUndefined();
        });
        it('should return undefined if the mnemonic is invalid', () => {
            const acct = algorand.getAccountFromMnemonic('test');
            expect(acct).toBeUndefined();
        });
        it('should return an account if the mnemonic is valid', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            const account = algorand.getAccountFromMnemonic(mnemonic);
            expect(account).toHaveProperty('addr', acct.addr);
        });
        it('should clean up the mnemonic before returning the account', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            // replaced spaced with commas
            let modifiedMnemonic = mnemonic.replace(/ /g, ',');
            let checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
            expect(checkedAcct).toHaveProperty('addr', acct.addr);
            // replace one space with two spaces in mnemonic
            modifiedMnemonic = mnemonic.replace(/ /g, '  ');
            checkedAcct = algorand.getAccountFromMnemonic(modifiedMnemonic);
            expect(checkedAcct).toHaveProperty('addr', acct.addr);
        });
    });
    describe('getMnemonicAccounts', () => {
        it('should throw an error if either mnemonic is invalid', () => {
            expect.assertions(3);
            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
            process.env.CLAIM_TOKEN_MNEMONIC = 'test';
            clearSystemPropertyCache();
            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
            process.env.CLAIM_TOKEN_MNEMONIC = mnemonic;
            process.env.CLAWBACK_TOKEN_MNEMONIC = 'test';
            clearSystemPropertyCache();

            try {
                algorand.getMnemonicAccounts();
            } catch (error) {
                expect(error).toHaveProperty('message', 'Failed to get accounts from mnemonics');
            }
        });
        it('should return the clawback account because the claim account is not set', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct);
            expect(accounts.token).toStrictEqual(acct);
        });
        it('should return the individual accounts', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            process.env.CLAIM_TOKEN_MNEMONIC = mnemonic;
            const acct2 = generateAccount();
            const mnemonic2 = secretKeyToMnemonic(acct2.sk);
            process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic2;
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct2);
            expect(accounts.token).toStrictEqual(acct);
        });
        it('should return the same account for both', () => {
            const acct = generateAccount();
            const mnemonic = secretKeyToMnemonic(acct.sk);
            process.env.CLAIM_TOKEN_MNEMONIC = mnemonic;
            process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
            const accounts = algorand.getMnemonicAccounts();
            expect(accounts.clawback).toStrictEqual(acct);
            expect(accounts.token).toStrictEqual(acct);
        });
    });
});
