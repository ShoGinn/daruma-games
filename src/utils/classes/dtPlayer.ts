import { injectable } from 'tsyringe';

import { AlgoNFTAsset, User } from '../../entities/index.js';
import { Database } from '../../services/index.js';
import { IGameStats, resolveDependency } from '../functions/index.js';
import { PlayerDice } from './index.js';

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
    constructor(userClass: User, userName: string, asset: AlgoNFTAsset, isNpc: boolean = false) {
        this.roundsData = PlayerDice.completeGameForPlayer();
        this.userClass = userClass;
        this.userName = userName;
        this.asset = asset;
        this.isWinner = false;
        this.isNpc = isNpc;
    }

    /**
     * @param karmaOnWin
     */
    async userAndAssetEndGameUpdate(
        gameWinInfo: DarumaTrainingPlugin.gameWinInfo,
        coolDown: number
    ): Promise<void> {
        if (this.isNpc) return;
        let db = await resolveDependency(Database);
        // Increment the wins and losses
        const finalStats: IGameStats = {
            wins: this.isWinner ? 1 : 0,
            losses: this.isWinner ? 0 : 1,
            // if winner and game.zen : zen is true
            zen: this.isWinner && gameWinInfo.zen ? 1 : 0,
        };

        await db.get(AlgoNFTAsset).assetEndGameUpdate(this.asset, coolDown, finalStats);

        if (this.isWinner) {
            await db.get(User).addKarma(this.userClass.id, gameWinInfo.payout);
        }
    }
}
