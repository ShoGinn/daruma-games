import { faker } from '@faker-js/faker';

import { AlgoNFTAsset } from '../../src/database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoStdAsset } from '../../src/database/algo-std-asset/algo-std-asset.schema.js';
import { DarumaTrainingChannel } from '../../src/database/dt-channel/dt-channel.schema.js';
import { Reward } from '../../src/database/rewards/rewards.schema.js';
import { DatabaseUser } from '../../src/database/user/user.schema.js';
import { GameTypes } from '../../src/enums/daruma-training.js';
import { DiscordId, WalletAddress } from '../../src/types/core.js';
import { ChannelSettings } from '../../src/types/daruma-training.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { buildGameType } from '../../src/utils/functions/dt-utils.js';

import {
  playerRoundsDataLongestGame,
  playerRoundsDataPerfectGame,
} from './mock-player-rounds-data.js';

export function mockedFakeUser(id?: DiscordId): DatabaseUser {
  const fakeUser: Partial<DatabaseUser> = {};
  fakeUser._id = id ?? (faker.string.numeric(9) as DiscordId);
  fakeUser.artifactToken = 0;
  fakeUser.toObject = jest.fn().mockReturnValue({ ...fakeUser });
  return fakeUser as DatabaseUser;
}
/**
 * Creates a fake AlgoNFTAsset object
 * Does not include Arc69
 *
 * @param {number} [id]
 * @param {boolean} [noObject]
 * @returns {*}  {AlgoNFTAsset}
 */
export function mockedFakeAlgoNFTAsset(id?: number, noObject?: boolean): AlgoNFTAsset {
  const fakeAsset = {
    _id: id ?? Number(faker.string.numeric(9)),
    creator: faker.string.numeric(9) as WalletAddress,
    name: faker.lorem.word(),
    unitName: faker.lorem.word(),
    url: faker.internet.url(),
    alias: faker.lorem.word(),
    battleCry: faker.company.catchPhrase(),
    wallet: faker.lorem.word() as WalletAddress,
    dojoCoolDown: new Date('2021-01-01'),
    dojoWins: 0,
    dojoLosses: 0,
    dojoZen: 0,
  } as AlgoNFTAsset;
  if (noObject) return fakeAsset;
  fakeAsset.toObject = jest.fn().mockReturnValue({ ...fakeAsset });
  return fakeAsset;
}
export function mockedFakePlayer(): Player {
  const fakeUser = mockedFakeUser();
  const fakeAlgoNFTAsset = mockedFakeAlgoNFTAsset();
  const mockedPlayer = new Player(fakeUser, fakeAlgoNFTAsset, Number(faker.string.numeric(9)));
  return mockedPlayer;
}
export function mockedFakeReward(stdAssetId?: number, tokenAmount?: number): Reward {
  const fakeReward = {
    discordUserId: faker.string.numeric(9) as DiscordId,
    walletAddress: faker.lorem.word() as WalletAddress,
    asaId: stdAssetId ?? Number(faker.string.numeric(9)),
    temporaryTokens: tokenAmount ?? Number(faker.string.numeric(2)),
  } as Reward;
  fakeReward.toObject = jest.fn().mockReturnValue({ ...fakeReward });
  return fakeReward;
}
export function mockedFakeStdAsset(id?: number): AlgoStdAsset {
  return {
    _id: id ?? Number(faker.string.numeric(9)),
    name: faker.lorem.word(),
    unitName: faker.lorem.word(),
    url: faker.internet.url(),
    decimals: 0,
  } as AlgoStdAsset;
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
    _id: faker.string.numeric(9),
    guild: faker.string.numeric(9),
    gameType: gameType,
  } as DarumaTrainingChannel;
}
export function mockChannelSettings(gameType: GameTypes): ChannelSettings {
  return buildGameType(mockFakeChannel(gameType), mockedFakeStdAsset());
}
