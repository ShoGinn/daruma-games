import { AbstractDatabaseRepository } from './abstract-database-repository.js';
import { AlgoNFTAsset } from '../entities/algo-nft-asset.entity.js';
import { User } from '../entities/user.entity.js';
import { InternalUserIDs } from '../enums/daruma-training.js';
import { Player } from '../utils/classes/dt-player.js';

export class DarumaTrainingGameRepository extends AbstractDatabaseRepository {
  public async getNPCPlayer(npcID: number): Promise<Player> {
    const em = this.orm.em.fork();
    const [botCreator, asset] = await Promise.all([
      em.getRepository(User).findOne({ id: InternalUserIDs.botCreator.toString() }),
      em.getRepository(AlgoNFTAsset).findOne({ id: npcID }),
    ]);
    if (!botCreator || !asset) {
      throw new Error(`Could not find bot creator or asset`);
    }
    return new Player(botCreator, asset);
  }
}
