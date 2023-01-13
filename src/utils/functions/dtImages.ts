import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);

/**
 * Takes the IPFS URL from an AlgoNFTAsset and returns a
 * gateway URL for the image. Or if the URL isn't an IPFS
 * URL, it returns the original URL.
 *
 * @param {string} url
 * @returns {*}  {string}
 */
function normalizeIpfsUrl(url: string): string {
    const ipfsURL = new URL(url);
    const ipfsGateway = new URL(
        (propertyResolutionManager.getProperty('IPFS_GATEWAY') as string) ||
            imageHosting.defaultIPFSGateway
    );
    if (ipfsURL.protocol.startsWith('ipfs')) {
        const newURL = new URL(ipfsURL.host, ipfsGateway);
        // Check for AlgoNode gateway
        if (ipfsGateway.host.includes('algonode')) {
            algoNodeOptions(newURL);
        }
        return newURL.toString();
    } else {
        return url;
    }
}

/**
 * Adds Params to the URL for AlgoNode Gateway
 *
 * @param {URL} url
 * @returns {*}  {URL}
 */
function algoNodeOptions(url: URL): URL {
    //Add search params to url
    url.searchParams.set('optimizer', 'image');
    url.searchParams.append('width', '270');
    return url;
}

/**
 * This is a function to take an IPFS url that is self hosted
 * and return a URL from the self hosted server.
 *
 * @export
 * @param {string} url
 * @returns {*}  {string}
 */
export function hostedConvertedGifUrl(url: string): string {
    const urlConverted = new URL(url); // Raw Url: (ipfs://Qm...#v)
    if (urlConverted.protocol.startsWith('ipfs')) {
        // if the url is an ipfs url
        const addGif = `${new URL(urlConverted.host, hostedImages().assets).toString()}.gif`;
        return addGif;
    } else {
        return url;
    }
}

export function getAssetUrl(asset: AlgoNFTAsset, zen?: boolean): string {
    let theUrl = '';
    if (asset?.altUrl) {
        theUrl = hostedConvertedGifUrl(asset.url);
    } else {
        let origUrl = asset?.url || imageHosting.failedImage;
        theUrl = normalizeIpfsUrl(origUrl);
    }
    if (zen && theUrl.includes('algonode')) {
        let saturated = new URL(theUrl);
        saturated.searchParams.append('saturation', '-100');
        return saturated.toString();
    }
    return theUrl;
}

/**
 * Checks if the url is available
 *
 * @export
 * @param {string} url
 * @returns {*}  {Promise<boolean>}
 */
export async function checkImageExists(url: string): Promise<boolean> {
    return await axios(url, { method: 'HEAD' })
        .then(res => {
            if (res.status === StatusCodes.OK) {
                return true;
            } else {
                return false;
            }
        })
        .catch(err => {
            logger.error(`Error: ${err.message}}`);
            logger.error(`Error: ${err.stack}}`);
            return false;
        });
}

/**
 * Returns the url of the hosted image (not an asset)
 *
 * @export
 * @param {string} imageName
 * @param {string} gameStatus
 * @param {string} [imageType='gif']
 * @returns {*}  {string}
 */
export function gameStatusHostedUrl(
    imageName: string,
    gameStatus: string,
    imageType: string = 'gif'
): string {
    // Add slash to end of gameStatus if it doesn't exist
    // ex. http://.../{gamesFolder}/{gameStatus}/{imageName}.{imageType}
    const gameStatusFolder = [gameStatus, gameStatus].join('/');
    const hostedGamesFolder = hostedImages().games; // http://.../{gamesFolder}/
    hostedGamesFolder.pathname = hostedGamesFolder.pathname + gameStatusFolder;

    const addGif = `${new URL(imageName.toString(), hostedGamesFolder).toString()}.${imageType}`;
    return addGif;
}
export function optimizedImageHostedUrl(imageName: string, imageType: string = 'gif'): string {
    const hostedOptimizedFolder = hostedImages().optimized;

    const addGif = `${new URL(
        imageName.toString(),
        hostedOptimizedFolder
    ).toString()}.${imageType}`;
    return addGif;
}

function hostedImages(): AlgorandPlugin.IHostedImages {
    const customHostingUrl = new URL(imageHosting.folder, imageHosting.url);

    const addedAssetFolder = new URL(imageHosting.assetDir, customHostingUrl);

    const addedGameFolder = new URL(imageHosting.gameDir, customHostingUrl);

    const addedOptimizedFolder = new URL(imageHosting.optimized_dir, customHostingUrl);

    const hostedImages: AlgorandPlugin.IHostedImages = {
        assets: addedAssetFolder,
        games: addedGameFolder,
        optimized: addedOptimizedFolder,
    };
    return hostedImages;
}

export const imageHosting = {
    url: 'https://shoginn.github.io/',
    folder: 'daruma-images/',
    assetDir: 'assets/',
    gameDir: 'game/',
    optimized_dir: 'daruma_bot_images/optimized/',
    failedImage: 'https://bit.ly/3d0AQ3p',
    defaultIPFSGateway: 'https://ipfs.algonode.xyz/ipfs/',
};
