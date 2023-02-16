import { EntityManager } from '@mikro-orm/core';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../entities/AlgoWallet.entity.js';
import { User } from '../../entities/User.entity.js';

interface CreateAssetFunc {
    creatorUser: User;
    creatorWallet: AlgoWallet;
    asset: AlgoNFTAsset;
}

export async function createRandomAsset(db: EntityManager): Promise<CreateAssetFunc> {
    const randomName = Math.random().toString(36).substring(7);
    const randomUnitName = Math.random().toString(36).substring(7);
    // create a random url that looks like a url
    const randomUrl = `https://${Math.random().toString(36).substring(7)}.com`;
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

export async function createRandomUser(db: EntityManager): Promise<User> {
    const userId = Math.random().toString(36).substring(7);
    const user = new User(userId);
    await db.getRepository(User).persistAndFlush(user);
    return user;
}
export async function createRandomWallet(user: User, db: EntityManager): Promise<AlgoWallet> {
    const walletAddress = Math.random().toString(36).substring(7);
    const wallet = new AlgoWallet(walletAddress, user);
    await db.getRepository(AlgoWallet).persistAndFlush(wallet);
    return wallet;
}
