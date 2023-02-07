import { describe, expect, it } from '@jest/globals';

// import fs from 'node:fs';

// import { AlgoNFTAsset } from '../../../entities/AlgoNFTAsset.js';
// import { AlgoWallet } from '../../../entities/AlgoWallet.js';
// import { User } from '../../../entities/User.js';
// import initializeMikroOrm from '../../../services/Database.js';
import { getAssetUrl, hostedImages, imageHosting } from '../dtImages.js';
describe('hostedImages', () => {
    it('returns the expected values', () => {
        const theseHostedImages = hostedImages();

        expect(theseHostedImages.assets.toString()).toMatch(
            `${imageHosting.url}${imageHosting.folder}${imageHosting.assetDir}`
        );
        expect(theseHostedImages.games.toString()).toMatch(
            `${imageHosting.url}${imageHosting.folder}${imageHosting.gameDir}`
        );
        expect(theseHostedImages.optimized.toString()).toMatch(
            `${imageHosting.url}${imageHosting.folder}${imageHosting.optimized_dir}`
        );
    });
});

describe('getAssetUrl', () => {
    //     it('returns the expected value for a given asset', async () => {
    //         // initialize MikroORM with a SQLite database
    //         const orm = await initializeMikroOrm();
    //         const db = orm.em.fork();
    //         const sql = await fs.promises.readFile(__dirname + '/jest.sql', 'utf-8');
    //         await orm.em.fork();
    //         await orm.em.nativeInsert(sql);

    //         const userRepo = db.getRepository(User);
    //         const user = new User();
    //         user.id = 'test';
    //         await userRepo.persistAndFlush(user);
    //         const creatorWallet: AlgoWallet = new AlgoWallet('test', user);
    //         const asset = new AlgoNFTAsset(1, creatorWallet, 'test', 'test', 'test');
    //         asset.url = 'https://ipfs.algonode.xyz/ipfs/Qmhash';
    //         asset.arc69 = { standard: 'arc69' };
    //         const url = await getAssetUrl(asset);
    //         expect(url).toBe('https://ipfs.algonode.xyz/ipfs/Qmhash');
    //         orm.close(true);
    //     });

    it('returns the failedImage URL if asset is not provided', async () => {
        const url = await getAssetUrl(null);
        expect(url).toBe(imageHosting.failedImage);
    });
});
