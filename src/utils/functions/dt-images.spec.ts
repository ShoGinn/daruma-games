import mockAxios from 'axios';
import { StatusCodes } from 'http-status-codes';

import { mockedFakeAlgoNFTAsset } from '../../../tests/mocks/mock-functions.js';

import {
  checkImageExists,
  gameStatusHostedUrl,
  getAssetUrl,
  hostedConvertedGifUrl,
  hostedImages,
  imageHosting,
  optimizedImageHostedUrl,
} from './dt-images.js';

jest.mock('axios');

describe('checkImageExists', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    mockRequest = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAxios as any).head = mockRequest;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns true for a valid URL', async () => {
    const mockResponse = { status: StatusCodes.OK };
    mockRequest.mockResolvedValueOnce(mockResponse);
    const result = await checkImageExists('https://example.com/image.jpg');
    expect(result).toBe(true);
  });

  test('returns false for an invalid URL', async () => {
    mockRequest.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });
    const result = await checkImageExists('https://example.com/nonexistent.jpg');
    expect(result).toBe(false);
  });
  test('returns an error for an invalid URL', async () => {
    mockRequest.mockRejectedValueOnce({ status: StatusCodes.BAD_GATEWAY });
    const result = await checkImageExists('https://example.com/nonexistent.jpg');
    expect(result).toBe(false);
  });
});

describe('hostedConvertedGifUrl', () => {
  test('should return the URL from the self hosted server for an IPFS URL', () => {
    const input = 'ipfs://Qm...#v';
    const expectedOutput = `${imageHosting.url}${imageHosting.folder}${imageHosting.assetDir}Qm....gif`;

    expect(hostedConvertedGifUrl(input)).toBe(expectedOutput);
  });

  test('should return the original URL if it is not an IPFS URL', () => {
    const input = 'https://google.com';
    const expectedOutput = 'https://google.com';

    expect(hostedConvertedGifUrl(input)).toBe(expectedOutput);
  });
});

describe('hostedImages', () => {
  test('returns the expected values', () => {
    const theseHostedImages = hostedImages();

    expect(theseHostedImages.assets.toString()).toMatch(
      `${imageHosting.url}${imageHosting.folder}${imageHosting.assetDir}`,
    );
    expect(theseHostedImages.games.toString()).toMatch(
      `${imageHosting.url}${imageHosting.folder}${imageHosting.gameDir}`,
    );
    expect(theseHostedImages.optimized.toString()).toMatch(
      `${imageHosting.url}${imageHosting.folder}${imageHosting.optimizedDir}`,
    );
  });
});
describe('optimizedImageHostedUrl', () => {
  test('returns the expected values', () => {
    const optimizedImgHostedUrl = optimizedImageHostedUrl('test');

    expect(optimizedImgHostedUrl).toMatch(
      `${imageHosting.url}${imageHosting.folder}${imageHosting.optimizedDir}`,
    );
  });
});
describe('gameStatusHostedUrl', () => {
  test('returns the expected values', () => {
    const gameStatusHostedUrlImg = gameStatusHostedUrl('test', 'test');

    expect(gameStatusHostedUrlImg).toMatch(
      `${imageHosting.url}${imageHosting.folder}${imageHosting.gameDir}`,
    );
  });
});
describe('getAssetUrl', () => {
  const asset = mockedFakeAlgoNFTAsset();
  test('returns the ipfs hosted url', async () => {
    asset.url = 'ipfs://bafybeihmsmcpvdphzqcvghq4anic64avbrimxskkulogj6wtijmfnk3b24#i';
    asset.arc69 = { standard: 'arc69' };
    const url = await getAssetUrl(asset);
    expect(url).toBe(
      'https://ipfs.algonode.xyz/ipfs/bafybeihmsmcpvdphzqcvghq4anic64avbrimxskkulogj6wtijmfnk3b24?optimizer=image&width=270',
    );
  });
  test('returns the hosted url for a video asset with #v', async () => {
    asset.url = 'ipfs://bafybeihevpbpqfvzwqpyahx3gid7gkaeex7u6fqh4z7jjwhtbcpz3cltoe#v';
    asset.arc69 = {
      standard: 'arc69',
      mime_type: 'video/mp4',
      properties: {
        ANIMATED: 'YES',
        'BODY DESIGN': 'Custom - Karasu Costume',
        'BACKGROUND (BG)': 'Custom - Custom Clouds',
        'ACCESSORY (BACK)': 'Custom - Karasu Switch',
        'ACCESSORY (FRONT)': 'Custom - Karasu Mask',
      },
      description:
        'Karasu Daruma is our 10th custom piece! Karasu was summoned by the Bodhidharma himself to help train the Darumas to enlightenment. Karasu is part of the Spooky Evolution <',
      external_url: 'https://www.algodaruma.com',
    };
    const url = await getAssetUrl(asset);
    expect(url).toBe(
      'https://shoginn.github.io/daruma-images/assets/bafybeihevpbpqfvzwqpyahx3gid7gkaeex7u6fqh4z7jjwhtbcpz3cltoe.gif',
    );
  });
  test('returns the hosted url for a video asset with video/mp4 mime type', async () => {
    asset.url = 'ipfs://bafybeihevpbpqfvzwqpyahx3gid7gkaeex7u6fqh4z7jjwhtbcpz3cltoe';
    asset.arc69 = {
      standard: 'arc69',
      mime_type: 'video/mp4',
      properties: {
        ANIMATED: 'YES',
        'BODY DESIGN': 'Custom - Karasu Costume',
        'BACKGROUND (BG)': 'Custom - Custom Clouds',
        'ACCESSORY (BACK)': 'Custom - Karasu Switch',
        'ACCESSORY (FRONT)': 'Custom - Karasu Mask',
      },
      description:
        'Karasu Daruma is our 10th custom piece! Karasu was summoned by the Bodhidharma himself to help train the Darumas to enlightenment. Karasu is part of the Spooky Evolution <',
      external_url: 'https://www.algodaruma.com',
    };
    const url = await getAssetUrl(asset);
    expect(url).toBe(
      'https://shoginn.github.io/daruma-images/assets/bafybeihevpbpqfvzwqpyahx3gid7gkaeex7u6fqh4z7jjwhtbcpz3cltoe.gif',
    );
  });

  test('returns the url if its just a url', async () => {
    asset.url = 'https://shoginn.github.io/daruma-images/game/npc/OneVsNpc.gif';
    asset.arc69 = { standard: 'arc69' };

    const url = await getAssetUrl(asset);
    expect(url).toBe('https://shoginn.github.io/daruma-images/game/npc/OneVsNpc.gif');
  });
  test('returns the url if its just a url and arc69 is null', async () => {
    asset.url = 'https://shoginn.github.io/daruma-images/game/npc/OneVsNpc.gif';
    //asset.arc69 = { standard: 'arc69' };

    const url = await getAssetUrl(asset);
    expect(url).toBe('https://shoginn.github.io/daruma-images/game/npc/OneVsNpc.gif');
  });

  test('returns the IPFS algonode url for zen', async () => {
    asset.url = 'ipfs://bafybeihmsmcpvdphzqcvghq4anic64avbrimxskkulogj6wtijmfnk3b24#i';
    asset.arc69 = { standard: 'arc69' };

    const url = await getAssetUrl(asset, true);
    expect(url).toBe(
      'https://ipfs.algonode.xyz/ipfs/bafybeihmsmcpvdphzqcvghq4anic64avbrimxskkulogj6wtijmfnk3b24?optimizer=image&width=270&saturation=-100',
    );
  });

  test('returns the failedImage URL if asset is not provided', async () => {
    const url = await getAssetUrl(null);
    expect(url).toBe(imageHosting.failedImage);
  });
  test('returns the failedImage URL if failedImage Url is provided', async () => {
    asset.url = '';
    asset.arc69 = { standard: 'arc69' };
    const url = await getAssetUrl(asset);
    expect(url).toBe(imageHosting.failedImage);
  });
});
