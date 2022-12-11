import { container, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { User } from '../../entities/User.js';
import { Database } from '../../services/Database.js';
import { IGameStats } from '../functions/dtUtils.js';
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
    private db: Database;
    constructor(userClass: User, userName: string, asset: AlgoNFTAsset, isNpc: boolean = false) {
        this.roundsData = PlayerDice.completeGameForPlayer();
        this.userClass = userClass;
        this.userName = userName;
        this.asset = asset;
        this.isWinner = false;
        this.isNpc = isNpc;
        this.db = container.resolve(Database);
    }

    /**
     * @param karmaOnWin
     */
    async userAndAssetEndGameUpdate(
        gameWinInfo: DarumaTrainingPlugin.gameWinInfo,
        coolDown: number
    ): Promise<void> {
        if (this.isNpc) return;
        // Increment the wins and losses
        const finalStats: IGameStats = {
            wins: this.isWinner ? 1 : 0,
            losses: this.isWinner ? 0 : 1,
            // if winner and game.zen : zen is true
            zen: this.isWinner && gameWinInfo.zen ? 1 : 0,
        };

        await this.db.get(AlgoNFTAsset).assetEndGameUpdate(this.asset, coolDown, finalStats);

        if (this.isWinner) {
            await this.db.get(User).addKarma(this.userClass.id, gameWinInfo.payout);
        }
    }
}
