import { TextChannel } from 'discord.js';

import { instance, mock, resetCalls, verify, when } from 'ts-mockito';

import { mockChannelSettings } from '../../../tests/mocks/mock-functions.js';
import { IUser } from '../../database/user/user.schema.js';
import { GameStatus, GameTypes } from '../../enums/daruma-training.js';
import { BoostService } from '../../services/boost-payout.js';
import { DarumaTrainingEncountersService } from '../../services/dt-encounters.js';
import { DiscordId } from '../../types/core.js';
import * as dtUtils from '../functions/dt-utils.js';

import { EmbedManager } from './dt-embedmanager.js';
import { Game } from './dt-game.js';
import { Player } from './dt-player.js';
import { WaitingRoomManager } from './dt-waitingroommanager.js';

describe('Game', () => {
  let game: Game;
  let mockWaitingRoomManager: WaitingRoomManager;
  let mockEmbedManager: EmbedManager;
  let mockBoostService: BoostService;
  let mockDtEncountersService: DarumaTrainingEncountersService;
  const mockedChannelSettingsOneVseNpc = mockChannelSettings(GameTypes.OneVsNpc);
  const mockedChannelSettingsOneVsOne = mockChannelSettings(GameTypes.OneVsOne);
  const mockChannel = mock(TextChannel);
  beforeEach(() => {
    mockWaitingRoomManager = mock(WaitingRoomManager);
    mockEmbedManager = mock(EmbedManager);
    mockBoostService = mock(BoostService);
    mockDtEncountersService = mock(DarumaTrainingEncountersService);

    game = new Game(
      instance(mockWaitingRoomManager),
      instance(mockEmbedManager),
      instance(mockBoostService),
      instance(mockDtEncountersService),
    );
  });
  it('should throw an error if state is not initialized', () => {
    expect(() => game.state).toThrow();
  });
  it('should throw an error if settings is not initialized', () => {
    expect(() => game.settings).toThrow();
  });
  it('should return the NPC', async () => {
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    expect(game.getNPC).toBeDefined();
  });
  it('should not return an NPC', async () => {
    await game.initialize(mockedChannelSettingsOneVsOne, instance(mockChannel));
    expect(game.getNPC).toBeUndefined();
  });
  it('should initialize', async () => {
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));

    expect(game.settings).toBe(mockedChannelSettingsOneVseNpc);
    expect(game.state.status).toBe(GameStatus.waitingRoom);
    verify(mockWaitingRoomManager.initialize(game, instance(mockChannel))).once();
  });

  it('should add a player', async () => {
    const mockPlayer = mock(Player);
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    // when(mockWaitingRoomManager.addPlayer(instance(mockPlayer))).thenReturn(true);

    const result = await game.addPlayer(instance(mockPlayer));

    expect(result).toBe(true);
    verify(mockEmbedManager.updateWaitingRoomEmbed(game)).once();
  });

  it('should remove a player', async () => {
    const mockPlayer = mock(Player);
    const mockDiscordId = '1234567890' as DiscordId; // replace with your mock DiscordId
    when(mockPlayer.dbUser).thenReturn({ _id: mockDiscordId } as IUser);
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    await game.addPlayer(instance(mockPlayer));
    resetCalls(mockEmbedManager);
    const result = await game.removePlayer(mockDiscordId);

    expect(result).toBe(true);
    verify(mockEmbedManager.updateWaitingRoomEmbed(game)).once();
  });
  it('should not remove a player', async () => {
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    const result = await game.removePlayer('1234567890' as DiscordId);
    expect(result).toBeFalsy();
  });
  it('should start a channel game', async () => {
    // Mock the methods called in startChannelGame
    when(mockDtEncountersService.create(game)).thenResolve(1);
    when(mockEmbedManager.startGame(game)).thenResolve();
    when(mockEmbedManager.finishGame(game)).thenResolve();
    const phaseDelaySpy = jest
      .spyOn(dtUtils, 'phaseDelay')
      .mockImplementation(() => Promise.resolve([0, 0]));

    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    await game.startChannelGame();
    expect(phaseDelaySpy).toHaveBeenCalled();
    verify(mockDtEncountersService.create(game)).once();
    verify(mockEmbedManager.startGame(game)).once();
    verify(mockEmbedManager.finishGame(game)).once();
  });
  it('should finish a game', async () => {
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    when(mockEmbedManager.finishGame(game)).thenResolve();

    await game['finishGame']();

    verify(mockEmbedManager.finishGame(game)).once();
  });
  it('should run the handleGameLogic method but throw an error', async () => {
    await game.initialize(mockedChannelSettingsOneVseNpc, instance(mockChannel));
    game.updateState(game.state.startGame(1));
    const mockPhaseDelayFunction = jest.fn().mockRejectedValue(new Error('test error'));
    await game['handleGameLogic'](mockPhaseDelayFunction);
    expect(mockPhaseDelayFunction).toHaveBeenCalled();
    expect(game.state.status).toBe(GameStatus.win);
  });
});
