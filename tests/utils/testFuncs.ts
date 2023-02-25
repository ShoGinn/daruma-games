import { faker } from '@faker-js/faker';
import { EntityManager } from '@mikro-orm/core';
import { GuildChannel } from 'discord.js';
import { Client } from 'discordx';

import { AlgoNFTAsset } from '../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from '../../src/entities/AlgoStdAsset.entity.js';
import { AlgoWallet } from '../../src/entities/AlgoWallet.entity.js';
import { DarumaTrainingChannel } from '../../src/entities/DtChannel.entity.js';
import { Guild } from '../../src/entities/Guild.entity.js';
import { User } from '../../src/entities/User.entity.js';
import { GameTypes } from '../../src/enums/dtEnums.js';
import { Game } from '../../src/utils/classes/dtGame.js';
import { Player } from '../../src/utils/classes/dtPlayer.js';
import { buildGameType } from '../../src/utils/functions/dtUtils.js';
interface CreateAssetFunc {
    creatorUser: User;
    creatorWallet: AlgoWallet;
    asset: AlgoNFTAsset;
}
interface UserGenerator {
    user: User;
    wallet: AlgoWallet;
    asset: CreateAssetFunc;
}
export async function createRandomAsset(db: EntityManager): Promise<CreateAssetFunc> {
    const creatorUser = await createRandomUser(db);
    const creatorWallet = await createRandomWallet(creatorUser, db);

    const asset = new AlgoNFTAsset(
        faker.datatype.number({ min: 1_000_000_000 }),
        creatorWallet,
        faker.name.firstName(),
        faker.name.lastName(),
        faker.internet.url()
    );
    await db.getRepository(AlgoNFTAsset).persistAndFlush(asset);
    return { creatorUser, creatorWallet, asset };
}

export async function createRandomUser(
    db: EntityManager,
    userName?: string | undefined
): Promise<User> {
    const userId = userName ?? faker.random.alphaNumeric(10);
    const user = new User(userId);
    await db.getRepository(User).persistAndFlush(user);
    return user;
}
export async function createRandomWallet(user: User, db: EntityManager): Promise<AlgoWallet> {
    const walletAddress = faker.finance.bitcoinAddress();
    const wallet = new AlgoWallet(walletAddress, user);
    await db.getRepository(AlgoWallet).persistAndFlush(wallet);
    return wallet;
}

export async function createRandomASA(db: EntityManager): Promise<AlgoStdAsset> {
    const asset = new AlgoStdAsset(
        faker.datatype.number({ min: 1_000_000_000 }),
        faker.name.firstName(),
        faker.name.lastName(),
        faker.internet.url()
    );
    await db.getRepository(AlgoStdAsset).persistAndFlush(asset);
    return asset;
}

export async function createRandomUserWithWalletAndAsset(
    db: EntityManager
): Promise<UserGenerator> {
    const user = await createRandomUser(db);
    const wallet = await createRandomWallet(user, db);
    const asset = await createRandomAsset(db);
    wallet.nft.add(asset.asset);
    await db.getRepository(AlgoWallet).persistAndFlush(wallet);
    return { user, wallet, asset };
}

export async function addRandomAssetAndWalletToUser(
    db: EntityManager,
    user: User
): Promise<AlgoNFTAsset> {
    const wallet = await createRandomWallet(user, db);
    const asset = await createRandomAsset(db);
    wallet.nft.add(asset.asset);
    await db.getRepository(AlgoWallet).persistAndFlush(wallet);
    return asset.asset;
}

export async function addRandomGuild(
    db: EntityManager,
    id: string = faker.random.alphaNumeric(10)
): Promise<Guild> {
    const guild = new Guild();
    guild.id = id;
    await db.getRepository(Guild).persistAndFlush(guild);
    return guild;
}

export async function addRandomTrainingChannel(
    db: EntityManager,
    client: Client
): Promise<DarumaTrainingChannel> {
    const channel = client.guilds.cache
        .get('guild-id')
        ?.channels.cache.get('channel-id') as GuildChannel;
    await addRandomGuild(db, channel.guildId);
    return await db.getRepository(DarumaTrainingChannel).addChannel(channel, GameTypes.OneVsNpc);
}

export async function createRandomGame(db: EntityManager, client: Client): Promise<Game> {
    const channel = await addRandomTrainingChannel(db, client);
    const gameSettings = buildGameType(channel);
    return new Game(gameSettings);
}

export async function addRandomUserToGame(
    db: EntityManager,
    client: Client,
    game: Game
): Promise<UserGenerator> {
    const dbPlayer = await createRandomUserWithWalletAndAsset(db);
    const player = new Player(dbPlayer.user, dbPlayer.asset.asset);
    game.addPlayer(player);
    return dbPlayer;
}
