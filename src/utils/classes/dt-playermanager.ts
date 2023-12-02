import { DiscordId } from '../../types/core.js';

import { Player } from './dt-player.js';

export class PlayerManager {
  private readonly players: Player[] = [];
  constructor(npc?: Player) {
    if (npc) {
      this.addPlayer(npc);
    }
  }
  addPlayer(player: Player): boolean {
    const existingPlayer = this.getPlayer(player.dbUser._id);

    if (!existingPlayer) {
      this.players.push(player);
      return true;
    }

    if (existingPlayer.playableNFT._id !== player.playableNFT._id) {
      existingPlayer.playableNFT = player.playableNFT;
      return true;
    }
    return false;
  }

  removePlayer(discordId: DiscordId): boolean {
    const playerIndex = this.getPlayerIndex(discordId);
    if (playerIndex >= 0) {
      this.players.splice(playerIndex, 1);
      return true;
    }
    return false;
  }

  getPlayer(discordId: DiscordId): Player | undefined {
    return this.players.find((player) => player.dbUser._id === discordId);
  }

  getPlayerIndex(discordId: DiscordId): number {
    return this.players.findIndex((player) => player.dbUser._id === discordId);
  }

  getAllPlayers(): Player[] {
    return this.players;
  }
  getPlayerCount(): number {
    return this.players.length;
  }
}
