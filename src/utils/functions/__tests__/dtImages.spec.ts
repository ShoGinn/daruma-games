import { describe, expect, it, jest } from '@jest/globals';
import { MikroORM } from '@mikro-orm/core';

import { AlgoNFTAsset } from '../../../entities/AlgoNFTAsset.entity.js';
import { AlgoWallet } from '../../../entities/AlgoWallet.entity.js';
import { User } from '../../../entities/User.entity.js';
import { initORM } from '../../../tests/utils/bootstrap.js';
import { getAssetUrl, hostedConvertedGifUrl, hostedImages, imageHosting } from '../dtImages.js';

describe('hostedConvertedGifUrl', () => {
    it('should return the URL from the self hosted server for an IPFS URL', () => {
        const input = 'ipfs://Qm...#v';
        const expectedOutput = `${imageHosting.url}${imageHosting.folder}${imageHosting.assetDir}Qm....gif`;

        expect(hostedConvertedGifUrl(input)).toBe(expectedOutput);
    });

    it('should return the original URL if it is not an IPFS URL', () => {
        const input = 'https://google.com';
        const expectedOutput = 'https://google.com';

        expect(hostedConvertedGifUrl(input)).toBe(expectedOutput);
    });
});

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
    jest.setTimeout(15_000);
    let orm: MikroORM;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    it('returns the expected value for a given asset', async () => {
        const db = orm.em.fork();
        const userRepo = db.getRepository(User);
        const user = new User();
        user.id = 'test';
        await userRepo.persistAndFlush(user);
        const creatorWallet: AlgoWallet = new AlgoWallet('test', user);
        const asset = new AlgoNFTAsset(1, creatorWallet, 'test', 'test', 'test');
        asset.url = 'https://ipfs.algonode.xyz/ipfs/Qmhash';
        asset.arc69 = { standard: 'arc69' };
        const url = await getAssetUrl(asset);
        expect(url).toBe('https://ipfs.algonode.xyz/ipfs/Qmhash');
    });

    it('returns the failedImage URL if asset is not provided', async () => {
        const url = await getAssetUrl(null);
        expect(url).toBe(imageHosting.failedImage);
    });
});
