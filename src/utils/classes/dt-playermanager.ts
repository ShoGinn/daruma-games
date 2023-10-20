import { Player } from './dt-player.js';

export class PlayerManager {
  private readonly players: Player[] = [];
  constructor(npc?: Player) {
    if (npc) {
      this.addPlayer(npc);
    }
  }
  addPlayer(player: Player): boolean {
    const existingPlayer = this.getPlayer(player.dbUser.id);

    if (!existingPlayer) {
      this.players.push(player);
      return true;
    }

    if (existingPlayer.playableNFT.id !== player.playableNFT.id) {
      existingPlayer.playableNFT = player.playableNFT;
      return true;
    }
    return false;
  }

  removePlayer(discordId: string): boolean {
    const playerIndex = this.getPlayerIndex(discordId);
    if (playerIndex >= 0) {
      this.players.splice(playerIndex, 1);
      return true;
    }
    return false;
  }

  getPlayer(discordId: string): Player | undefined {
    return this.players.find((player) => player.dbUser.id === discordId);
  }

  getPlayerIndex(discordId: string): number {
    return this.players.findIndex((player) => player.dbUser.id === discordId);
  }

  getAllPlayers(): Player[] {
    return this.players;
  }
  getPlayerCount(): number {
    return this.players.length;
  }
}
