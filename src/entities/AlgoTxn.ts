import {
  Entity,
  EntityRepositoryType,
  PrimaryKey,
  Property,
} from '@mikro-orm/core'
import { EntityRepository } from '@mikro-orm/sqlite'

import { CustomBaseEntity } from './BaseEntity'

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoTxnRepository })
export class AlgoTxn extends CustomBaseEntity {
  [EntityRepositoryType]?: AlgoTxnRepository

  @PrimaryKey()
  id: number

  @Property()
  discordId: string

  @Property()
  txnType: string

  @Property({ type: 'json', nullable: true })
  claimResponse?: any
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoTxnRepository extends EntityRepository<AlgoTxn> {
  async addTxn(discordId: string, txnType: string, claimResponse?: any) {
    const txn = new AlgoTxn()
    txn.discordId = discordId
    txn.txnType = txnType
    txn.claimResponse = claimResponse
    await this.persistAndFlush(txn)
  }
}
