import { instance, mock, when } from 'ts-mockito';

import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';
import { AlgoNFTAsset } from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { GameStatus } from '../../enums/daruma-training.js';
import { Player } from '../classes/dt-player.js';

import { createPlayerField } from './dt-embeds.js';

describe('createPlayerField', () => {
  let mockPlayer: Player;
  let mockAsset: AlgoNFTAsset;
  let gameStatus: GameStatus;
  let zen: boolean;

  beforeEach(() => {
    zen = false;
    gameStatus = GameStatus.finished;
    mockPlayer = mock(Player);
    mockAsset = mockedFakeAlgoNFTAsset();
    when(mockPlayer.playableNFT).thenReturn(mockAsset);
  });

  describe('NPC Messages', () => {
    beforeEach(() => {
      when(mockPlayer.isNpc).thenReturn(true);
    });
    it('should create a embed field for a non winning NPC for a non finished game', async () => {
      gameStatus = GameStatus.activeGame;
      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(` :one: - ***${mockAsset.alias}*** - (NPC)`);
    });
    it('should create a embed field for a non winning NPC', async () => {
      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(`:x: :one: - ***${mockAsset.alias}*** - (NPC)`);
    });
    it('should create a embed field for a winning NPC', async () => {
      when(mockPlayer.isWinner).thenReturn(true);
      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(`:white_check_mark: :one: - ***${mockAsset.alias}*** - (NPC)`);
    });
    it('should create a embed field for a zen NPC', async () => {
      zen = true;
      when(mockPlayer.isWinner).thenReturn(true);

      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(
        `:yin_yang::white_check_mark: :one: - ***${mockAsset.alias}*** - (NPC)`,
      );
    });
  });
  describe('Player Messages', () => {
    beforeEach(() => {
      when(mockPlayer.isNpc).thenReturn(false);
    });

    it('should create a embed field for a non winning player', async () => {
      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(`:x: :one: - ***${mockAsset.alias}*** - (<@undefined>)`);
    });
    it('should create a embed field for a winning player', async () => {
      when(mockPlayer.isWinner).thenReturn(true);
      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(
        `:white_check_mark: :one: - ***${mockAsset.alias}*** - (<@undefined>)`,
      );
    });
    it('should create a embed field for a zen player', async () => {
      zen = true;
      when(mockPlayer.isWinner).thenReturn(true);

      const result = await createPlayerField(gameStatus, zen, instance(mockPlayer), 0);

      expect(result.name).toBe('\u200B');
      expect(result.value).toBe(
        `:yin_yang::white_check_mark: :one: - ***${mockAsset.alias}*** - (<@undefined>)`,
      );
    });
  });
});
