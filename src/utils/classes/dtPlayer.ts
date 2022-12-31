import { MikroORM } from '@mikro-orm/core';
import { container, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { AlgoStdAsset } from '../../entities/AlgoStdAsset.js';
import { AlgoStdToken } from '../../entities/AlgoStdToken.js';
import { User } from '../../entities/User.js';
import { IGameStats, rollForCoolDown } from '../functions/dtUtils.js';
import { PlayerDice } from './dtPlayerDice.js';

/**
 * Player Class
 * Represents a player registered in an active game
 */
@injectable()
export class Player {
    public roundsData: DarumaTrainingPlugin.PlayerRoundsData;
    public userClass: User;
    public userName: string;
    public isWinner: boolean;
    public isNpc: boolean;
    public asset: AlgoNFTAsset;
    public unclaimedTokens: number;
    public randomCoolDown: number;
    public coolDownModified: boolean;
    private orm: MikroORM;
    constructor(userClass: User, userName: string, asset: AlgoNFTAsset, isNpc: boolean = false) {
        this.roundsData = PlayerDice.completeGameForPlayer();
        this.userClass = userClass;
        this.userName = userName;
        this.asset = asset;
        this.unclaimedTokens = 0;
        this.isWinner = false;
        this.isNpc = isNpc;
        this.randomCoolDown = 0;
        this.coolDownModified = false;
        this.orm = container.resolve(MikroORM);
    }

    /**
     * @param karmaOnWin
     */
    async userAndAssetEndGameUpdate(
        gameWinInfo: DarumaTrainingPlugin.gameWinInfo,
        coolDown: number
    ): Promise<void> {
        const em = this.orm.em.fork();
        const algoNFTAssetDB = em.getRepository(AlgoNFTAsset);
        const algoStdTokenDb = em.getRepository(AlgoStdToken);
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        const karmaAsset = await algoStdAsset.getStdAssetByUnitName('KRMA');

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
            const ownerWallet = await algoNFTAssetDB.getOwnerWalletFromAssetIndex(
                this.asset.assetIndex
            );
            // Add payout to the owner wallet
            this.unclaimedTokens = await algoStdTokenDb.addUnclaimedTokens(
                ownerWallet,
                karmaAsset.assetIndex,
                gameWinInfo.payout
            );
        }
    }
}
