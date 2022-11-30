import { algorandConfig } from '@config'
import { AlgoNFTAsset } from '@entities'
import axios from 'axios'

/**
 * Takes the IPFS URL from an AlgoNFTAsset and returns a
 * gateway URL for the image. Or if the URL isn't an IPFS
 * URL, it returns the original URL.
 *
 * @param {string} url
 * @returns {*}  {string}
 */
function normalizeIpfsUrl(url: string): string {
  const ipfsURL = new URL(url)
  const ipfsGateway = new URL(
    process.env.IPFS_GATEWAY || algorandConfig.defaultIPFSGateway
  )
  if (ipfsURL.protocol.startsWith('ipfs')) {
    const newURL = new URL(ipfsURL.host, ipfsGateway)
    // Check for AlgoNode gateway
    if (ipfsGateway.host.includes('algonode')) {
      algoNodeOptions(newURL)
    }
    return newURL.toString()
  } else {
    return url
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
  url.searchParams.set('optimizer', 'image')
  url.searchParams.append('width', '270')
  return url
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
  const urlConverted = new URL(url) // Raw Url: (ipfs://Qm...#v)
  if (urlConverted.protocol.startsWith('ipfs')) {
    // if the url is an ipfs url
    const addGif = `${new URL(
      urlConverted.host,
      hostedImages().assets
    ).toString()}.gif`
    return addGif
  } else {
    return url
  }
}

export function getAssetUrl(asset: AlgoNFTAsset, zen?: boolean): string {
  let theUrl = ''
  if (asset?.altUrl) {
    theUrl = hostedConvertedGifUrl(asset.url)
  } else {
    let origUrl = asset?.url || algorandConfig.failedImage
    theUrl = normalizeIpfsUrl(origUrl)
  }
  if (zen && theUrl.includes('algonode')) {
    let saturated = new URL(theUrl)
    saturated.searchParams.append('saturation', '-100')
    return saturated.toString()
  }
  return theUrl
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
      if (res.status === 200) {
        return true
      } else {
        return false
      }
    })
    .catch(err => {
      console.log('Error:', err)
      return false
    })
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
  imageType = 'gif'
): string {
  // Add slash to end of gameStatus if it doesn't exist
  // ex. http://.../{gamesFolder}/{gameStatus}/{imageName}.{imageType}
  const gameStatusFolder = [gameStatus, gameStatus].join('/')
  const hostedGamesFolder = hostedImages().games // http://.../{gamesFolder}/
  hostedGamesFolder.pathname = hostedGamesFolder.pathname + gameStatusFolder

  const addGif = `${new URL(
    imageName.toString(),
    hostedGamesFolder
  ).toString()}.${imageType}`
  return addGif
}

function hostedImages(): AlgorandPlugin.IHostedImages {
  const customHostingUrl = new URL(
    algorandConfig.imageHosting.folder,
    algorandConfig.imageHosting.url
  )

  const addedAssetFolder = new URL(
    algorandConfig.imageHosting.assetDir,
    customHostingUrl
  )

  const addedGameFolder = new URL(
    algorandConfig.imageHosting.gameDir,
    customHostingUrl
  )

  const hostedImages: AlgorandPlugin.IHostedImages = {
    assets: addedAssetFolder,
    games: addedGameFolder,
  }
  return hostedImages
}
