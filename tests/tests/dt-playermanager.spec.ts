import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { PlayerManager } from '../../src/utils/classes/dt-playermanager.js';
import { mockedFakeAlgoNFTAsset, mockedFakeUser } from '../utils/fake-mocks.js';

describe('PlayerManager', () => {
  let playerManager: PlayerManager;
  let fakeUser: User;
  let fakeUser2: User;
  let fakeAsset: AlgoNFTAsset;
  let fakeAsset2: AlgoNFTAsset;

  beforeEach(() => {
    playerManager = new PlayerManager();
    fakeUser = mockedFakeUser();
    fakeAsset = mockedFakeAlgoNFTAsset();
    fakeUser2 = mockedFakeUser();
    fakeAsset2 = mockedFakeAlgoNFTAsset();
  });

  // Act and Assert
  test('should add a player to the players array if the player does not exist', () => {
    // Arrange
    const playerToAdd = new Player(fakeUser, fakeAsset);

    // Act
    const result = playerManager.addPlayer(playerToAdd);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(1);
    expect(playerManager.getPlayer(playerToAdd.dbUser.id)).toBe(playerToAdd);
  });

  test('should update the playableNFT of an existing player if the playableNFT id is different', () => {
    // Arrange
    const existingPlayer = new Player(fakeUser, fakeAsset);
    playerManager.addPlayer(existingPlayer);
    const updatedPlayer = { ...existingPlayer, playableNFT: fakeAsset2 } as Player;

    // Act
    const result = playerManager.addPlayer(updatedPlayer);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(1);
    expect(playerManager.getPlayer(existingPlayer.dbUser.id)).toEqual(updatedPlayer);
  });

  test('should not add a player if the player already exists', () => {
    // Arrange
    const existingPlayer = new Player(fakeUser, fakeAsset);
    playerManager.addPlayer(existingPlayer);

    // Act
    const result = playerManager.addPlayer(existingPlayer);

    // Assert
    expect(result).toBe(false);
    expect(playerManager.getPlayerCount()).toBe(1);
  });

  test('should remove a player from the players array if the player exists', () => {
    // Arrange
    const playerToRemove = new Player(fakeUser, fakeAsset);
    playerManager.addPlayer(playerToRemove);

    // Act
    const result = playerManager.removePlayer(playerToRemove.dbUser.id);

    // Assert
    expect(result).toBe(true);
    expect(playerManager.getPlayerCount()).toBe(0);
    expect(playerManager.getPlayer(playerToRemove.dbUser.id)).toBeUndefined();
  });

  test('should not remove a player if the player does not exist', () => {
    // Arrange
    const playerToRemove = new Player(fakeUser, fakeAsset);

    // Act
    const result = playerManager.removePlayer(playerToRemove.dbUser.id);

    // Assert
    expect(result).toBe(false);
    expect(playerManager.getPlayerCount()).toBe(0);
  });

  test('should return the player with the given discordId if it exists', () => {
    // Arrange
    const playerToFind = new Player(fakeUser, fakeAsset);
    playerManager.addPlayer(playerToFind);

    // Act
    const result = playerManager.getPlayer(playerToFind.dbUser.id);

    // Assert
    expect(result).toBe(playerToFind);
  });

  test('should return undefined if the player with the given discordId does not exist', () => {
    // Arrange
    const playerToFind = new Player(fakeUser, fakeAsset);

    // Act
    const result = playerManager.getPlayer(playerToFind.dbUser.id);

    // Assert
    expect(result).toBeUndefined();
  });

  test('should return the index of the player with the given discordId if it exists', () => {
    // Arrange
    const playerToFind = new Player(fakeUser, fakeAsset);
    playerManager.addPlayer(playerToFind);

    // Act
    const result = playerManager.getPlayerIndex(playerToFind.dbUser.id);

    // Assert
    expect(result).toBe(0);
  });

  test('should return -1 if the player with the given discordId does not exist', () => {
    // Arrange
    const playerToFind = new Player(fakeUser, fakeAsset);

    // Act
    const result = playerManager.getPlayerIndex(playerToFind.dbUser.id);

    // Assert
    expect(result).toBe(-1);
  });

  test('should return all players in the players array', () => {
    // Arrange
    const player1 = new Player(fakeUser, fakeAsset);
    const player2 = new Player(fakeUser2, fakeAsset2);
    playerManager.addPlayer(player1);
    playerManager.addPlayer(player2);

    // Act
    const result = playerManager.getAllPlayers();

    // Assert
    expect(result).toEqual([player1, player2]);
  });

  test('should return the number of players in the players array', () => {
    // Arrange
    const player1 = new Player(fakeUser, fakeAsset);
    const player2 = new Player(fakeUser2, fakeAsset2);
    playerManager.addPlayer(player1);
    playerManager.addPlayer(player2);

    // Act
    const result = playerManager.getPlayerCount();

    // Assert
    expect(result).toBe(2);
  });
});
