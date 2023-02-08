import { describe, expect, it } from '@jest/globals';
import { MikroORM } from '@mikro-orm/core';

import { AlgoNFTAsset } from '../../../entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../../entities/AlgoWallet.entity.js';
import { User } from '../../../entities/User.entity.js';
import { GameTypes } from '../../../enums/dtEnums.js';
import { initORM } from '../../../tests/utils/bootstrap.js';
import {
    assetCurrentRank,
    buildGameType,
    calculateFactorChancePct,
    calculateIncAndDec,
    calculateTimePct,
    IIncreaseDecrease,
    karmaPayoutCalculator,
    rollForCoolDown,
} from '../dtUtils.js';

describe('karmaPayoutCalculator', () => {
    const tokenSettings = {
        baseAmount: 30,
        roundModifier: 5,
        zenMultiplier: 3.5,
        zenRoundModifier: 0.5,
    };

    it('calculates correct payout for a round less than 5 with zen false', () => {
        const winningRound = 4;
        const zen = false;
        const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
        expect(result).toEqual(30);
    });
    it('calculates correct payout for a round less than 5 with zen true', () => {
        const winningRound = 4;
        const zen = true;
        const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
        expect(result).toEqual(105);
    });

    it('calculates correct payout for a round greater than 5 with zen false', () => {
        const winningRound = 7;
        const zen = false;
        const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
        expect(result).toEqual(40);
    });

    it('calculates correct payout for a round greater than 5 with zen true', () => {
        const winningRound = 7;
        const zen = true;
        const result = karmaPayoutCalculator(winningRound, tokenSettings, zen);
        expect(result).toEqual(180);
    });
});

describe('buildGameType', () => {
    const darumaTrainingChannel = {
        createdAt: new Date(),
        updatedAt: new Date(),
        id: 'channel-id',
        messageId: 'message-id',
        gameType: GameTypes.OneVsNpc,
    };

    it('calculates correct settings for OneVsNpc', () => {
        const result = buildGameType(darumaTrainingChannel);
        expect(result).toEqual({
            minCapacity: 2,
            maxCapacity: 2,
            channelId: 'channel-id',
            messageId: 'message-id',
            gameType: GameTypes.OneVsNpc,
            coolDown: 21600000,
            token: {
                baseAmount: 5,
                roundModifier: 5,
                zenMultiplier: 1,
                zenRoundModifier: 0.5,
            },
        });
    });

    it('calculates correct settings for OneVsOne', () => {
        darumaTrainingChannel.gameType = GameTypes.OneVsOne;
        const result = buildGameType(darumaTrainingChannel);
        expect(result).toEqual({
            minCapacity: 2,
            maxCapacity: 2,
            channelId: 'channel-id',
            messageId: 'message-id',
            gameType: GameTypes.OneVsOne,
            coolDown: 21600000,
            token: {
                baseAmount: 20,
                roundModifier: 5,
                zenMultiplier: 1.5,
                zenRoundModifier: 0.5,
            },
        });
    });

    it('calculates correct settings for FourVsNpc', () => {
        darumaTrainingChannel.gameType = GameTypes.FourVsNpc;
        const result = buildGameType(darumaTrainingChannel);
        expect(result).toEqual({
            minCapacity: 5,
            maxCapacity: 5,
            channelId: 'channel-id',
            messageId: 'message-id',
            gameType: GameTypes.FourVsNpc,
            coolDown: 5400000,
            token: {
                baseAmount: 30,
                roundModifier: 5,
                zenMultiplier: 3.5,
                zenRoundModifier: 0.5,
            },
        });
    });
});
describe('calculateIncAndDec', () => {
    const medianMaxes = {
        aboveMedianMax: {
            increase: 10,
            decrease: 5,
        },
        belowMedianMax: {
            increase: 15,
            decrease: 10,
        },
    };

    it('calculates correct increase and decrease for asset stat above average', () => {
        const assetStat = 8;
        const average = 5;
        const result = calculateIncAndDec(medianMaxes, assetStat, average);
        expect(result).toEqual({ increase: 4, decrease: 2 });
    });

    it('calculates correct increase and decrease for asset stat below average', () => {
        const assetStat = 2;
        const average = 5;
        const result = calculateIncAndDec(medianMaxes, assetStat, average);
        expect(result).toEqual({ increase: 12, decrease: 8 });
    });

    it('calculates correct increase and decrease for asset stat equal to average', () => {
        const assetStat = 5;
        const average = 5;
        const result = calculateIncAndDec(medianMaxes, assetStat, average);
        expect(result).toEqual({ increase: 3, decrease: 2 });
    });
    it('calculates correct increase and decrease for asset stat max above', () => {
        const assetStat = 50;
        const average = 5;
        const result = calculateIncAndDec(medianMaxes, assetStat, average);
        expect(result).toEqual({ increase: 10, decrease: 5 });
    });
    it('calculates correct increase and decrease for asset stat max below', () => {
        const assetStat = 1;
        const average = 5;
        const result = calculateIncAndDec(medianMaxes, assetStat, average);
        expect(result).toEqual({ increase: 15, decrease: 10 });
    });
});
describe('calculateTimePct', () => {
    it('should calculate the increase and decrease times correctly', () => {
        const factorPct = { increase: 10, decrease: 5 };
        const channelCoolDown = 60000;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result.increase).toBeGreaterThan(0);
        expect(result.decrease).toBeGreaterThan(0);
    });
    it('returns for max decrease', () => {
        const factorPct = { increase: 0, decrease: 0.8 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 0,
            decrease: 360,
        });
    });
    it('returns for max increase', () => {
        const factorPct = { increase: 0.3, decrease: 0.2 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 288,
            decrease: 90,
        });
    });
    it('returns 0 for decrease when decreaseMaxChance is 0', () => {
        const factorPct = { increase: 0.3, decrease: 0 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 288,
            decrease: 0,
        });
    });

    it('returns 0 for increase when increaseMaxChance is 0', () => {
        const factorPct = { increase: 0, decrease: 0.2 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 0,
            decrease: 90,
        });
    });

    it('returns correct values for channelCoolDown = 0', () => {
        const factorPct = { increase: 0.3, decrease: 0.2 };
        const channelCoolDown = 0;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 0,
            decrease: 0,
        });
    });

    it('returns correct values for incPct = 0', () => {
        const factorPct = { increase: 0, decrease: 0.2 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 0,
            decrease: 90,
        });
    });

    it('returns correct values for decPct = 0', () => {
        const factorPct = { increase: 0.3, decrease: 0 };
        const channelCoolDown = 360;

        const result = calculateTimePct(factorPct, channelCoolDown);

        expect(result).toEqual({
            increase: 288,
            decrease: 0,
        });
    });
});

describe('calculateFactorChancePct', () => {
    const bonusStats: DarumaTrainingPlugin.gameBonusData = {
        averageTotalGames: 25,
        averageTotalAssets: 5,
        averageRank: 120,
        assetTotalGames: 0,
        userTotalAssets: 0,
        assetRank: 0,
        averageWins: 0,
        assetWins: 0,
    };

    it('calculates the increase/decrease chance correctly', () => {
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeGreaterThan(0);
        expect(result.decrease).toBeGreaterThan(0);
    });
    it('calculates for a brand new daruma owner', () => {
        bonusStats.assetTotalGames = 1;
        bonusStats.userTotalAssets = 1;
        bonusStats.assetRank = 1000;
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeCloseTo(0, 2);
        expect(result.decrease).toBeCloseTo(0.8, 2);
    });
    it('calculates for a massive owner', () => {
        bonusStats.assetTotalGames = 200;
        bonusStats.userTotalAssets = 80;
        bonusStats.assetRank = 1;
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeCloseTo(0.3, 2);
        expect(result.decrease).toBeCloseTo(0.2, 2);
    });
    it('calculates for a normal owner', () => {
        bonusStats.assetTotalGames = 10;
        bonusStats.userTotalAssets = 3;
        bonusStats.assetRank = 118;
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeCloseTo(0.0025, 3);
        expect(result.decrease).toBeCloseTo(0.504, 3);
    });
    it('calculates for a diamond owner', () => {
        bonusStats.assetTotalGames = 40;
        bonusStats.userTotalAssets = 16;
        bonusStats.assetRank = 10;
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeCloseTo(0.2485, 3);
        expect(result.decrease).toBeCloseTo(0.2, 3);
    });
    it('calculates for a demon owner', () => {
        bonusStats.assetTotalGames = 20;
        bonusStats.userTotalAssets = 7;
        bonusStats.assetRank = 25;
        const result: IIncreaseDecrease = calculateFactorChancePct(bonusStats);
        expect(result.increase).toBeCloseTo(0.1, 3);
        expect(result.decrease).toBeCloseTo(0.224, 3);
    });
});
let orm: MikroORM;
let user: User;
let asset: AlgoNFTAsset;
beforeAll(async () => {
    orm = await initORM();
    const db = orm.em.fork();
    const userRepo = db.getRepository(User);
    user = new User();
    user.id = 'test';
    await userRepo.persistAndFlush(user);
    const creatorWallet: AlgoWallet = new AlgoWallet('test', user);
    asset = new AlgoNFTAsset(50000, creatorWallet, 'test', 'test', 'test');
});
afterAll(async () => {
    await orm.close(true);
});

describe('rollForCoolDown', () => {
    it('returns the cooldown sent because no other assets exists', async () => {
        const result = await rollForCoolDown(asset, 'test', 3600);
        expect(result).toEqual(3600);
    });
});
describe('assetCurrentRank', () => {
    it('gets the assets current rank', async () => {
        const result = await assetCurrentRank(asset);
        expect(result).toEqual({ currentRank: '0', totalAssets: '0' });
    });
});
