import { mockedFakeAlgoNFTAsset, mockedFakePlayer } from '../../../tests/setup/fake-mocks.js';

import { Player } from './dt-player.js';
import { PlayerManager } from './dt-playermanager.js';

describe('PlayerManager', () => {
  let playerManager: PlayerManager;
  let player1: Player;
  let player2: Player;
  let fakeAsset2;

  beforeEach(() => {
    playerManager = new PlayerManager();
    player1 = mockedFakePlayer();
    player2 = mockedFakePlayer();
    fakeAsset2 = mockedFakeAlgoNFTAsset();
  });

  // Act and Assert
  test('should add a player to the players array if the player does not exist', () => {
    // Arrange

    // Act
    const result = playerManager.addPlayer(player1);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(1);
    expect(playerManager.getPlayer(player1.dbUser._id)).toBe(player1);
  });

  test('should update the playableNFT of an existing player if the playableNFT id is different', () => {
    // Arrange
    playerManager.addPlayer(player1);
    const updatedPlayer = { ...player1, playableNFT: fakeAsset2 } as Player;

    // Act
    const result = playerManager.addPlayer(updatedPlayer);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(1);
    expect(playerManager.getPlayer(player1.dbUser._id)).toEqual(updatedPlayer);
  });

  test('should not add a player if the player already exists', () => {
    // Arrange
    playerManager.addPlayer(player1);

    // Act
    const result = playerManager.addPlayer(player1);

    // Assert
    expect(result).toBe(false);
    expect(playerManager.getPlayerCount()).toBe(1);
  });

  test('should remove a player from the players array if the player exists', () => {
    // Arrange
    playerManager.addPlayer(player1);

    // Act
    const result = playerManager.removePlayer(player1.dbUser._id);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(0);
    expect(playerManager.getPlayer(player1.dbUser._id)).toBeUndefined();
  });

  test('should not remove a player if the player does not exist', () => {
    // Arrange

    // Act
    const result = playerManager.removePlayer(player1.dbUser._id);

    // Assert
    expect(result).toBe(false);
    expect(playerManager.getPlayerCount()).toBe(0);
  });

  test('should return the player with the given discordId if it exists', () => {
    // Arrange
    playerManager.addPlayer(player1);

    // Act
    const result = playerManager.getPlayer(player1.dbUser._id);

    // Assert
    expect(result).toBe(player1);
  });

  test('should return undefined if the player with the given discordId does not exist', () => {
    // Arrange

    // Act
    const result = playerManager.getPlayer(player1.dbUser._id);

    // Assert
    expect(result).toBeUndefined();
  });

  test('should return the index of the player with the given discordId if it exists', () => {
    // Arrange
    playerManager.addPlayer(player1);

    // Act
    const result = playerManager.getPlayerIndex(player1.dbUser._id);

    // Assert
    expect(result).toBe(0);
  });

  test('should return -1 if the player with the given discordId does not exist', () => {
    // Arrange

    // Act
    const result = playerManager.getPlayerIndex(player1.dbUser._id);

    // Assert
    expect(result).toBe(-1);
  });

  test('should return all players in the players array', () => {
    // Arrange
    playerManager.addPlayer(player1);
    playerManager.addPlayer(player2);

    // Act
    const result = playerManager.getAllPlayers();

    // Assert
    expect(result).toEqual([player1, player2]);
  });

  test('should return the number of players in the players array', () => {
    // Arrange
    playerManager.addPlayer(player1);
    playerManager.addPlayer(player2);

    // Act
    const result = playerManager.getPlayerCount();

    // Assert
    expect(result).toBe(2);
  });
});
