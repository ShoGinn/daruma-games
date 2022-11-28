import { AlgoNFTAsset, User } from '@entities'
import { Database } from '@services'
import { Game, PlayerDice } from '@utils/classes'
import { IGameStats, resolveDependency } from '@utils/functions'
import { injectable } from 'tsyringe'

/**
 * Player Class
 * Represents a player registered in an active game
 */
@injectable()
export class Player {
  public roundsData: DarumaTrainingPlugin.PlayerRoundsData
  public userClass: User
  public userName: string
  public isWinner: boolean
  public isNpc: boolean
  public asset: AlgoNFTAsset
  public assetRank: number
  constructor(
    userClass: User,
    userName: string,
    asset: AlgoNFTAsset,
    isNpc = false
  ) {
    this.roundsData = PlayerDice.completeGameForPlayer()
    this.userClass = userClass
    this.userName = userName
    this.asset = asset
    this.isWinner = false
    this.isNpc = isNpc
  }

  /**
   * @param karmaOnWin
   */
  async doEndOfGameMutation(game: Game): Promise<void> {
    if (this.isNpc) return
    let db = await resolveDependency(Database)
    const { coolDown } = game.settings
    // Increment the wins and losses
    const finalStats: IGameStats = {
      wins: this.isWinner ? 1 : 0,
      losses: this.isWinner ? 0 : 1,
      // if winner and game.zen : zen is true
      zen: this.isWinner && game.zen ? 1 : 0,
    }

    await db.get(AlgoNFTAsset).postGameSync(this.asset, coolDown, finalStats)

    if (this.isWinner) {
      await db.get(User).addKarma(this.userClass.id, game.payout)
    }
  }
}
