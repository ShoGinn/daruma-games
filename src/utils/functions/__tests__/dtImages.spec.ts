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
    // it('returns the expected value for a given asset', async () => {
    //     const creatorWallet: AlgoWallet; // = new AlgoWallet('test', 'test', 'test');
    //     const asset = new AlgoNFTAsset(1, creatorWallet, 'test', 'test', 'test');
    //     asset.url = 'https://ipfs.algonode.xyz/ipfs/Qmhash';

    //     const url = await getAssetUrl(asset);
    //     expect(url).toBe('https://ipfs.algonode.xyz/ipfs/Qmhash');
    // });

    it('returns the failedImage URL if asset is not provided', async () => {
        const url = await getAssetUrl(null);
        expect(url).toBe(imageHosting.failedImage);
    });
});
