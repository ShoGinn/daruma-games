export const algorandConfig: AlgorandPlugin.AlgoConfigType = {
    imageHosting: {
        url: 'https://shoginn.github.io/',
        folder: 'daruma-images/',
        assetDir: 'assets/',
        gameDir: 'game/',
    },
    failedImage: 'https://bit.ly/3d0AQ3p',
    defaultIPFSGateway: 'https://ipfs.algonode.xyz/ipfs/',
    defaultAlgoApi: {
        main: 'https://mainnet-algorand.api.purestake.io/ps2',
        test: 'https://testnet-algorand.api.purestake.io/ps2',
        indexer: 'https://mainnet-algorand.api.purestake.io/idx2',
        max_api_resources: 1000,
    },
};
