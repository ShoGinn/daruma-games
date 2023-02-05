import { MikroORM } from '@mikro-orm/core';
import { injectable, singleton } from 'tsyringe';

import { AlgoStdAsset } from '../../entities/AlgoStdAsset.entity.js';
import logger from '../../utils/functions/LoggerFactory.js';
import { PostConstruct } from '../framework/decorators/PostConstruct.js';

@singleton()
@injectable()
export class GameAssets {
    constructor(private orm: MikroORM) {}
    public karmaAsset?: AlgoStdAsset;
    public enlightenmentAsset?: AlgoStdAsset;
    public allAssetNames: Array<string> = [];
    public get ready(): boolean {
        return this.karmaAsset !== undefined && this.enlightenmentAsset !== undefined;
    }

    @PostConstruct
    async initKRMA(): Promise<void> {
        const karmaAssetName = 'KRMA';
        this.allAssetNames.push(karmaAssetName);
        const em = this.orm.em.fork();
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        try {
            this.karmaAsset = await algoStdAsset.getStdAssetByUnitName(karmaAssetName);
        } catch (error) {
            logger.error(`\n\nFailed to get the necessary assets (Karma) from the database\n\n`);
            return;
        }
    }
    @PostConstruct
    async initENLT(): Promise<void> {
        const enlightenmentAssetName = 'ENLT';
        this.allAssetNames.push(enlightenmentAssetName);
        const em = this.orm.em.fork();
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        try {
            this.enlightenmentAsset = await algoStdAsset.getStdAssetByUnitName(
                enlightenmentAssetName
            );
        } catch (error) {
            logger.error(
                `\n\nFailed to get the necessary assets (Enlightenment) from the database\n\n`
            );
            return;
        }
    }
    async initAll(): Promise<void> {
        Promise.all([this.initKRMA(), this.initENLT()]).catch(_error => {
            logger.error(`\n\nFailed to get the necessary assets from the database\n\n`);
        });
    }
}
