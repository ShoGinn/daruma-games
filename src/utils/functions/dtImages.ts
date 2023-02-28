import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';

import logger from './LoggerFactory.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { PropertyResolutionManager } from '../../model/framework/manager/PropertyResolutionManager.js';
const propertyResolutionManager = container.resolve(PropertyResolutionManager);
interface IHostedImages {
    assets: URL;
    games: URL;
    optimized: URL;
}

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
    return urlConverted.protocol.startsWith('ipfs')
        ? `${new URL(urlConverted.host, hostedImages().assets).toString()}.gif`
        : url;
}

export async function getAssetUrl(asset: AlgoNFTAsset | null, zen?: boolean): Promise<string> {
    if (!asset) return imageHosting.failedImage;
    let theUrl = asset.url || imageHosting.failedImage;

    if (
        asset.url?.endsWith('#v') ||
        JSON.stringify(asset.arc69).match(/video|animated/gi) !== null
    ) {
        theUrl = hostedConvertedGifUrl(asset.url);
        if (!(await checkImageExists(theUrl))) {
            logger.info(`Image URL for Asset ID:${asset.id} does not exist: ${theUrl}`);
        }
    } else {
        theUrl = normalizeIpfsUrl(theUrl);
    }

    if (zen && theUrl.includes('algonode')) {
        const saturated = new URL(theUrl);
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
 * @returns {Promise<boolean>}
 */
export async function checkImageExists(url: string): Promise<boolean> {
    try {
        const res = await axios.head(url);
        if (res.status === StatusCodes.OK) {
            return true;
        } else if (res.status === StatusCodes.NOT_FOUND) {
            logger.error(`Error: ${res.status} - ${res.statusText}`);
            return false;
        }
    } catch (err) {
        logger.error(`Error: ${JSON.stringify(err)}`);
    }
    return false;
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
    hostedGamesFolder.pathname += gameStatusFolder;

    return `${new URL(imageName.toString(), hostedGamesFolder).toString()}.${imageType}`;
}

/**
 * Returns the url of the hosted image (not an asset)
 *
 * @export
 * @param {string} imageName
 * @param {string} [imageType='gif']
 * @returns {*}  {string}
 */
export function optimizedImageHostedUrl(imageName: string, imageType: string = 'gif'): string {
    const hostedOptimizedFolder = hostedImages().optimized;

    return `${new URL(imageName.toString(), hostedOptimizedFolder).toString()}.${imageType}`;
}

/**
 * Returns the url of the hosted image (not an asset)
 *
 * @export
 * @returns {*}  {IHostedImages}
 */
export function hostedImages(): IHostedImages {
    const { url, folder, assetDir, gameDir, optimized_dir } = imageHosting;
    const customHostingUrl = new URL(folder, url);

    return {
        assets: new URL(assetDir, customHostingUrl),
        games: new URL(gameDir, customHostingUrl),
        optimized: new URL(optimized_dir, customHostingUrl),
    };
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
