declare namespace AlgorandPlugin {
    type AlgoConfigType = {
        imageHosting: {
            url: string;
            folder: string;
            assetDir: string;
            gameDir: string;
        };
        failedImage: string;
        defaultIPFSGateway: string;
        defaultAlgoApi: {
            main: string;
            test: string;
            indexer: string;
            max_api_resources: number;
        };
    };
}
