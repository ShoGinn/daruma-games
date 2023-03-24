import { faker } from '@faker-js/faker';
import { EntityManager } from '@mikro-orm/core';
import { generateAccount } from 'algosdk';
import { GuildChannel } from 'discord.js';
import { Client } from 'discordx';

import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import { AlgoStdAsset } from '../../src/entities/algo-std-asset.entity.js';
import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { DarumaTrainingChannel } from '../../src/entities/dt-channel.entity.js';
import { Guild } from '../../src/entities/guild.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { GameTypes } from '../../src/enums/daruma-training.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { buildGameType } from '../../src/utils/functions/dt-utils.js';
interface CreateAssetFunction {
    creatorUser: User;
    creatorWallet: AlgoWallet;
    asset: AlgoNFTAsset;
}
interface PlayerGenerator {
    user: User;
    wallet: AlgoWallet;
    asset: CreateAssetFunction;
}
interface UserGenerator {
    user: User;
    wallet: AlgoWallet;
}
export function generateDiscordId(): string {
    const id = faker.datatype
        .number({
            min: 100_000_000_000_000_000,
            // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
            max: 999_999_999_999_999_999,
        })
        .toString();
    return id;
}
export function generateAlgoWalletAddress(): string {
    return generateAccount().addr;
}

export async function createRandomAsset(database: EntityManager): Promise<CreateAssetFunction> {
    const creatorUser = await createRandomUser(database);
    const creatorWallet = await createRandomWallet(database, creatorUser);

    const asset = new AlgoNFTAsset(
        faker.datatype.number({ min: 1_000_000_000 }),
        creatorWallet,
        faker.name.firstName(),
        faker.name.lastName(),
        faker.internet.url()
    );
    await database.getRepository(AlgoNFTAsset).persistAndFlush(asset);
    return { creatorUser, creatorWallet, asset };
}

export async function createRandomUser(
    database: EntityManager,
    discordId: string = generateDiscordId()
): Promise<User> {
    const user = new User(discordId);
    await database.getRepository(User).persistAndFlush(user);
    return user;
}
export async function createRandomWallet(database: EntityManager, user: User): Promise<AlgoWallet> {
    const walletAddress = generateAlgoWalletAddress();
    const wallet = new AlgoWallet(walletAddress, user);
    user.algoWallets.add(wallet);
    await database.getRepository(User).persistAndFlush(user);
    await database.getRepository(AlgoWallet).persistAndFlush(wallet);
    return wallet;
}

export async function createRandomASA(
    database: EntityManager,
    name: string = faker.name.firstName(),
    unitName: string = faker.name.lastName()
): Promise<AlgoStdAsset> {
    const asset = new AlgoStdAsset(
        faker.datatype.number({ min: 1_000_000_000 }),
        name,
        unitName,
        faker.internet.url()
    );
    await database.getRepository(AlgoStdAsset).persistAndFlush(asset);
    return asset;
}
export async function createRandomUserWithRandomWallet(
    database: EntityManager
): Promise<UserGenerator> {
    const user = await createRandomUser(database);
    const wallet = await createRandomWallet(database, user);
    return { user, wallet };
}
export async function createRandomUserWithWalletAndAsset(
    database: EntityManager
): Promise<PlayerGenerator> {
    const { user, wallet } = await createRandomUserWithRandomWallet(database);
    const asset = await createRandomAsset(database);
    wallet.nft.add(asset.asset);
    await database.getRepository(AlgoWallet).persistAndFlush(wallet);
    return { user, wallet, asset };
}

export async function addRandomAssetAndWalletToUser(
    database: EntityManager,
    user: User
): Promise<{ asset: AlgoNFTAsset; wallet: AlgoWallet }> {
    const wallet = await createRandomWallet(database, user);
    // add wallet to user
    user.algoWallets.add(wallet);
    await database.getRepository(User).persistAndFlush(user);
    const asset = await createRandomAsset(database);
    wallet.nft.add(asset.asset);
    await database.getRepository(AlgoWallet).persistAndFlush(wallet);
    return { asset: asset.asset, wallet };
}

export async function addRandomGuild(
    database: EntityManager,
    guildId: string = generateDiscordId()
): Promise<Guild> {
    const guild = new Guild();
    guild.id = guildId;
    const guildRepo = database.getRepository(Guild);
    // check if the guild exists first
    const guildExists = await guildRepo.getGuild(guildId).catch(() => false);
    if (guildExists) return guild;

    // if it doesn't exist, create it
    await guildRepo.persistAndFlush(guild);

    return guild;
}

export async function addRandomTrainingChannel(
    database: EntityManager,
    client: Client,
    gameType: GameTypes
): Promise<DarumaTrainingChannel> {
    const channel = client.guilds.cache
        .get('guild-id')
        ?.channels.cache.get('channel-id') as GuildChannel;
    await addRandomGuild(database, channel.guildId);
    return await database.getRepository(DarumaTrainingChannel).addChannel(channel, gameType);
}

export async function createRandomGame(
    database: EntityManager,
    client: Client,
    gameType: GameTypes = GameTypes.OneVsNpc
): Promise<Game> {
    const channel = await addRandomTrainingChannel(database, client, gameType);
    const gameSettings = buildGameType(channel);
    return new Game(gameSettings);
}

export async function addRandomUserToGame(
    database: EntityManager,
    client: Client,
    game: Game
): Promise<PlayerGenerator> {
    const databasePlayer = await createRandomUserWithWalletAndAsset(database);
    const player = new Player(databasePlayer.user, databasePlayer.asset.asset);
    game.addPlayer(player);
    return databasePlayer;
}
export async function createRandomPlayer(
    database: EntityManager
): Promise<{ databasePlayer: PlayerGenerator; player: Player }> {
    const databasePlayer = await createRandomUserWithWalletAndAsset(database);
    const player = new Player(databasePlayer.user, databasePlayer.asset.asset);
    return { databasePlayer, player };
}
