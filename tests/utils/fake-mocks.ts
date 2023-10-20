import { faker } from '@faker-js/faker';

import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import { DarumaTrainingChannel } from '../../src/entities/dt-channel.entity.js';
import { Guild } from '../../src/entities/guild.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { GameTypes } from '../../src/enums/daruma-training.js';
import { ChannelSettings } from '../../src/model/types/daruma-training.js';
import { DarumaTrainingGameRepository } from '../../src/repositories/dt-game-repository.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { buildGameType } from '../../src/utils/functions/dt-utils.js';
import {
  playerRoundsDataLongestGame,
  playerRoundsDataPerfectGame,
} from '../mocks/mock-player-rounds-data.js';
export function mockedFakeUser(id?: string): User {
  const fakeUser = jest.fn() as unknown as User;
  fakeUser.id = id ?? faker.string.numeric(9);
  return fakeUser;
}
export function mockedFakeAlgoNFTAsset(id?: number): AlgoNFTAsset {
  return new AlgoNFTAsset(
    id ?? Number(faker.string.numeric(9)),
    undefined,
    faker.person.jobTitle(),
    faker.person.jobArea(),
    faker.internet.url(),
  ) as unknown as AlgoNFTAsset;
}
export function mockedFakePlayer(): Player {
  const fakeUser = mockedFakeUser();
  const fakeAlgoNFTAsset = mockedFakeAlgoNFTAsset();
  const mockedPlayer = new Player(fakeUser, fakeAlgoNFTAsset);
  mockedPlayer.userAndAssetEndGameUpdate = jest.fn();
  return mockedPlayer;
}
export function mockedFakePlayerLongestGame(): Player {
  const fakePlayer = mockedFakePlayer();
  fakePlayer.roundsData = playerRoundsDataLongestGame;
  return fakePlayer;
}
export function mockedFakePlayerPerfectGame(): Player {
  const fakePlayer = mockedFakePlayer();
  fakePlayer.roundsData = playerRoundsDataPerfectGame;
  return fakePlayer;
}
export function mockFakeChannel(gameType: GameTypes): DarumaTrainingChannel {
  return {
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 'channel-id',
    messageId: 'message-id',
    guild: new Guild(),
    gameType: gameType,
  };
}
export function mockChannelSettings(gameType: GameTypes): ChannelSettings {
  return buildGameType(mockFakeChannel(gameType));
}
export function mockFakeGame(gameType: GameTypes): Game {
  const mockedChannelSettings = mockChannelSettings(gameType);
  // must mock this repo only because it uses the Database
  const mockRepo = {
    getNPCPlayer: jest.fn().mockImplementation(() => mockedFakePlayer()),
    createEncounter: jest.fn().mockReturnValue({ id: 1 }),
  };
  return new Game(mockedChannelSettings, mockRepo as unknown as DarumaTrainingGameRepository);
}
