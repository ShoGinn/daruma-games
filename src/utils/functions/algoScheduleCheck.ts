import { container } from 'tsyringe';

import { AlgoWallet } from '../../entities/AlgoWallet.js';
import { Data } from '../../entities/Data.js';
import { Algorand } from '../../services/Algorand.js';
import { Database } from '../../services/Database.js';
import { moreThanTwentyFourHoursAgo } from './algoDate.js';

export async function isUserAssetsSynced(): Promise<void> {
    const db = container.resolve(Database);
    const algorand = container.resolve(Algorand);

    const dataRepository = db.get(Data);
    const userAssetSyncData = await dataRepository.get('userAssetSync');
    const lastSync = moreThanTwentyFourHoursAgo(userAssetSyncData);
    if (lastSync) {
        await algorand.userAssetSync();
    }
}
export async function isCreatorAssetsSynced(): Promise<void> {
    const db = container.resolve(Database);
    const algorand = container.resolve(Algorand);
    const dataRepository = db.get(Data);
    const creatorAssetSyncData = await dataRepository.get('creatorAssetSync');
    const lastSync = moreThanTwentyFourHoursAgo(creatorAssetSyncData);
    if (lastSync) {
        await algorand.creatorAssetSync();
    }
}
export async function updateCreatorAssetSync(): Promise<void> {
    const db = container.resolve(Database);
    const dataRepository = db.get(Data);
    await dataRepository.set('creatorAssetSync', Date.now());
}
export async function updateUserAssetSync(): Promise<void> {
    const db = container.resolve(Database);
    const dataRepository = db.get(Data);
    await dataRepository.set('userAssetSync', Date.now());
}
export async function createNPCs(): Promise<void> {
    const db = container.resolve(Database);
    const algoWallet = db.get(AlgoWallet);
    await algoWallet.createBotNPCs();
}
