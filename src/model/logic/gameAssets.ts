import { MikroORM } from '@mikro-orm/core';
import { injectable, singleton } from 'tsyringe';

import { AlgoStdAsset } from '../../entities/AlgoStdAsset.entity.js';
import logger from '../../utils/functions/LoggerFactory.js';
import { PostConstruct } from '../framework/decorators/PostConstruct.js';
@singleton()
@injectable()
export class GameAssets {
    constructor(private orm: MikroORM) {}
    [key: string]: unknown;
    public karmaAsset?: AlgoStdAsset;
    public enlightenmentAsset?: AlgoStdAsset;
    private initializedAssets = new Set<string>();
    public isReady(): boolean {
        return this.initializedAssets.size === 2;
    }
    private async initAsset(assetName: string, target: string): Promise<boolean> {
        const em = this.orm.em.fork();
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        try {
            this[target] = await algoStdAsset.getStdAssetByUnitName(assetName);
            this.initializedAssets.add(target);
        } catch {
            logger.error(
                `\n\nFailed to get the necessary assets (${assetName}) from the database\n\n`
            );
            return false;
        }
        return true;
    }
    @PostConstruct
    async initKRMA(): Promise<boolean> {
        return await this.initAsset('KRMA', 'karmaAsset');
    }
    @PostConstruct
    async initENLT(): Promise<boolean> {
        return await this.initAsset('ENLT', 'enlightenmentAsset');
    }
    async initAll(): Promise<[boolean, boolean]> {
        return await Promise.all([this.initKRMA(), this.initENLT()]);
    }
}
