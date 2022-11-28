import { algorandConfig } from '@config'
import { AlgoNFTAsset } from '@entities'
import { hostedImages } from '@utils/functions'

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
function algoNodeOptions(url: URL): URL {
  //Add search params to url
  url.searchParams.set('optimizer', 'image')
  url.searchParams.append('width', '270')
  return url
}

export const hostedConvertedGifUrl = (url: string): string => {
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
