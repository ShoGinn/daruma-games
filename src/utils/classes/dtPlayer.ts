import type {
    gameWinInfo,
    IGameStats,
    PlayerRoundsData,
} from '../../model/types/darumaTraining.js';
import { MikroORM } from '@mikro-orm/core';
import { container, injectable } from 'tsyringe';

import { PlayerDice } from './dtPlayerDice.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoStdToken } from '../../entities/AlgoStdToken.entity.js';
import { User } from '../../entities/User.entity.js';
import { GameNPCs } from '../../enums/dtEnums.js';
import { GameAssets } from '../../model/logic/gameAssets.js';
import { rollForCoolDown } from '../functions/dtUtils.js';

/**
 * Player Class
 * Represents a player registered in an active game
 */
@injectable()
export class Player {
    public roundsData: PlayerRoundsData;
    public userClass: User;
    public isWinner: boolean;
    public asset: AlgoNFTAsset;
    public unclaimedTokens: number;
    public randomCoolDown: number;
    public coolDownModified: boolean;
    private orm: MikroORM;
    private gameAssets: GameAssets;
    constructor(userClass: User, asset: AlgoNFTAsset) {
        this.roundsData = PlayerDice.completeGameForPlayer();
        this.userClass = userClass;
        this.asset = asset;
        this.unclaimedTokens = 0;
        this.isWinner = false;
        this.randomCoolDown = 0;
        this.coolDownModified = false;
        this.orm = container.resolve(MikroORM);
        this.gameAssets = container.resolve(GameAssets);
    }
    public get isNpc(): boolean {
        return GameNPCs.find(npc => npc.assetIndex === this.asset.id) !== undefined;
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
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');

        const em = this.orm.em.fork();
        const algoNFTAssetDB = em.getRepository(AlgoNFTAsset);
        const algoStdTokenDb = em.getRepository(AlgoStdToken);
        const karmaAsset = this.gameAssets.karmaAsset;

        if (this.isNpc) return;
        // Increment the wins and losses
        const finalStats: IGameStats = {
            wins: this.isWinner ? 1 : 0,
            losses: this.isWinner ? 0 : 1,
            // if winner and game.zen : zen is true
            zen: this.isWinner && gameWinInfo.zen ? 1 : 0,
        };
        // Roll for a random cooldown
        this.randomCoolDown = await rollForCoolDown(this.asset, this.userClass.id, coolDown);
        if (this.randomCoolDown !== coolDown) this.coolDownModified = true;
        // Add Random cooldown to the asset
        await algoNFTAssetDB.assetEndGameUpdate(this.asset, this.randomCoolDown, finalStats);

        if (this.isWinner) {
            // get NFT Asset owner wallet
            const ownerWallet = await algoNFTAssetDB.getOwnerWalletFromAssetIndex(this.asset.id);
            // Add payout to the owner wallet
            this.unclaimedTokens = await algoStdTokenDb.addUnclaimedTokens(
                ownerWallet,
                karmaAsset.id,
                gameWinInfo.payout
            );
        }
    }
}
