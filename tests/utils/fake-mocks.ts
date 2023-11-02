import { faker } from '@faker-js/faker';

import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import { AlgoStdAsset } from '../../src/entities/algo-std-asset.entity.js';
import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { IDarumaTrainingChannel } from '../../src/entities/dt-channel.mongo.js';
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
export function mockedFakeWallet(): AlgoWallet {
  return new AlgoWallet(faker.string.numeric(9), undefined) as unknown as AlgoWallet;
}
export function mockedFakeAlgoNFTAsset(id?: number): AlgoNFTAsset {
  return new AlgoNFTAsset(
    id ?? Number(faker.string.numeric(9)),
    undefined,
    faker.lorem.word(),
    faker.lorem.word(),
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
export function mockedFakeStdAsset(): AlgoStdAsset {
  return new AlgoStdAsset(
    Number(faker.string.numeric(9)),
    faker.lorem.word(),
    faker.lorem.word(),
    faker.internet.url(),
  );
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
export function mockFakeChannel(gameType: GameTypes): IDarumaTrainingChannel {
  return {
    _id: 'channel-id',
    id: 'channel-id',
    guild: 'guild-id',
    gameType: gameType,
  } as unknown as IDarumaTrainingChannel;
}
export function mockChannelSettings(gameType: GameTypes): ChannelSettings {
  return buildGameType(mockFakeChannel(gameType));
}
export function mockFakeGame(gameType: GameTypes): Game {
  const mockedChannelSettings = mockChannelSettings(gameType);
  // must mock this repo only because it uses the Database
  const mockRepo = {
    getNPCPlayer: jest.fn().mockImplementation(() => mockedFakePlayer()),
  };
  return new Game(mockedChannelSettings, mockRepo as unknown as DarumaTrainingGameRepository);
}
