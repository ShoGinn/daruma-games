import type {
    gameWinInfo,
    IGameStats,
    PlayerRoundsData,
} from '../../model/types/darumaTraining.js';
import { MikroORM } from '@mikro-orm/core';
import { container, injectable } from 'tsyringe';

import { PlayerDice } from './dtPlayerDice.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from '../../entities/AlgoStdAsset.entity.js';
import { AlgoStdToken } from '../../entities/AlgoStdToken.entity.js';
import { User } from '../../entities/User.entity.js';
import { GameNPCs } from '../../enums/dtEnums.js';
import { GameAssets } from '../../model/logic/gameAssets.js';
import { rollForCoolDown } from '../functions/dtUtils.js';
import logger from '../functions/LoggerFactory.js';

/**
 * Player Class
 * Represents a player registered in an active game
 */
@injectable()
export class Player {
    public roundsData: PlayerRoundsData;
    public dbUser: User;
    public isWinner: boolean;
    public playableNFT: AlgoNFTAsset;
    public randomCoolDown: number;
    public coolDownModified: boolean;
    constructor(databaseUser: User, playableNFT: AlgoNFTAsset) {
        this.roundsData = PlayerDice.completeGameForPlayer();
        this.dbUser = databaseUser;
        this.playableNFT = playableNFT;
        this.isWinner = false;
        this.randomCoolDown = 0;
        this.coolDownModified = false;
    }
    public get isNpc(): boolean {
        return GameNPCs.some(npc => npc.assetIndex === this.playableNFT.id);
    }

    /**
     * Update the user and asset after the game ends
     *
     * @param {gameWinInfo} gameWinInfo
     * @param {number} coolDown
     * @returns {*}  {Promise<void>}
     * @memberof Player
     */
    async userAndAssetEndGameUpdate(gameWinInfo: gameWinInfo, coolDown: number): Promise<void> {
        if (this.isNpc) return;
        try {
            const gameAssets = container.resolve(GameAssets);
            const karmaAsset = gameAssets.karmaAsset;
            if (!karmaAsset) {
                throw new Error('Karma Asset Not Found');
            }
            // Increment the wins and losses
            const finalStats: IGameStats = {
                wins: this.isWinner ? 1 : 0,
                losses: this.isWinner ? 0 : 1,
                // if winner and game.zen : zen is true
                zen: this.isWinner && gameWinInfo.zen ? 1 : 0,
            };
            // Roll for a random cooldown
            this.randomCoolDown = await rollForCoolDown(this.playableNFT, this.dbUser.id, coolDown);
            this.coolDownModified = this.randomCoolDown !== coolDown;
            await this.updateAsset(finalStats);
            await this.updateWinner(karmaAsset, gameWinInfo.payout);
        } catch (error) {
            logger.error('Error during userAndAssetEndGameUpdate:', error);
        }
    }
    async updateAsset(finalStats: IGameStats): Promise<void> {
        const orm = container.resolve(MikroORM);
        const em = orm.em.fork();
        const algoNFTAssetDB = em.getRepository(AlgoNFTAsset);
        await algoNFTAssetDB.assetEndGameUpdate(this.playableNFT, this.randomCoolDown, finalStats);
    }

    async updateWinner(karmaAsset: AlgoStdAsset, payout: number): Promise<void> {
        if (this.isWinner) {
            const orm = container.resolve(MikroORM);
            const em = orm.em.fork();
            const algoNFTAssetDB = em.getRepository(AlgoNFTAsset);
            const algoStdTokenDatabase = em.getRepository(AlgoStdToken);
            const ownerWallet = await algoNFTAssetDB.getOwnerWalletFromAssetIndex(
                this.playableNFT.id
            );
            await algoStdTokenDatabase.addUnclaimedTokens(ownerWallet, karmaAsset.id, payout);
        }
    }
}
