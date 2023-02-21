import { EntityManager } from '@mikro-orm/core';
import { randomBytes } from 'node:crypto';

import { AlgoNFTAsset } from '../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../src/entities/AlgoWallet.entity.js';
import { User } from '../../src/entities/User.entity.js';
interface CreateAssetFunc {
    creatorUser: User;
    creatorWallet: AlgoWallet;
    asset: AlgoNFTAsset;
}
export function generateRandomString(length: number): string {
    const bytes = randomBytes(Math.ceil(length / 2));
    return bytes.toString('hex').slice(0, length);
}
export async function createRandomAsset(db: EntityManager): Promise<CreateAssetFunc> {
    const randomName = generateRandomString(10);
    const randomUnitName = generateRandomString(10);
    // create a random url that looks like a url
    const randomUrl = `https://${generateRandomString(10)}.com`;
    const creatorUser = await createRandomUser(db);
    const creatorWallet = await createRandomWallet(creatorUser, db);
    const assetIndex = Math.floor(Math.random() * 100000);
    const asset = new AlgoNFTAsset(
        assetIndex,
        creatorWallet,
        randomName,
        randomUnitName,
        randomUrl
    );
    await db.getRepository(AlgoNFTAsset).persistAndFlush(asset);
    return { creatorUser, creatorWallet, asset };
}

export async function createRandomUser(
    db: EntityManager,
    userName?: string | undefined
): Promise<User> {
    const userId = userName ?? generateRandomString(10);
    const user = new User(userId);
    await db.getRepository(User).persistAndFlush(user);
    return user;
}
export async function createRandomWallet(user: User, db: EntityManager): Promise<AlgoWallet> {
    const walletAddress = generateRandomString(10);
    const wallet = new AlgoWallet(walletAddress, user);
    await db.getRepository(AlgoWallet).persistAndFlush(wallet);
    return wallet;
}
