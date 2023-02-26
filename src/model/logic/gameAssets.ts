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
    public allAssetNames: Array<string> = [];
    public get ready(): boolean {
        return this.isReady();
    }
    private isReady(): boolean {
        return this.allAssetNames.every(name => this[name] !== undefined);
    }

    private async initAsset(assetName: string, target: string): Promise<void> {
        this.allAssetNames.push(assetName);
        const em = this.orm.em.fork();
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        try {
            this[target] = await algoStdAsset.getStdAssetByUnitName(assetName);
        } catch (error) {
            logger.error(
                `\n\nFailed to get the necessary assets (${assetName}) from the database\n\n`
            );
            return;
        }
    }
    @PostConstruct
    async initKRMA(): Promise<void> {
        await this.initAsset('KRMA', 'karmaAsset');
    }
    @PostConstruct
    async initENLT(): Promise<void> {
        await this.initAsset('ENLT', 'enlightenmentAsset');
    }
    async initAll(): Promise<void | [void, void]> {
        return await Promise.all([this.initKRMA(), this.initENLT()]).catch(_error => {
            logger.error(`\n\nFailed to get the necessary assets from the database\n\n`);
        });
    }
}
