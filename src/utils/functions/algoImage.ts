import { algorandConfig } from '@config'
import axios from 'axios'

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

export function hostedImages(): IHostedImages {
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

  const hostedImages: IHostedImages = {
    assets: addedAssetFolder,
    games: addedGameFolder,
  }
  return hostedImages
}
interface IHostedImages {
  assets: URL
  games: URL
}
