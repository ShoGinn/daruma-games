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
    // fetch pending txn within the last 5 minutes
    const pendingTxn = await this.findOne({
      discordId,
      txnType,
      createdAt: {
        $gt: new Date(new Date().getTime() - 5 * 60 * 1000),
      },
    })
    // if pending txn exists, update it
    if (pendingTxn) {
      if (
        claimResponse.status?.txn.txn.aamt !==
        pendingTxn.claimResponse.pendingKarma
      ) {
        console.error(
          'Pending txn amount does not match claim response amount -- Adding new txn'
        )
        console.error(
          `Expected ${pendingTxn.claimResponse.pendingKarma} but got ${claimResponse.status?.txn.txn.aamt}`
        )
        pendingTxn.txnType = 'failed'
        await this.persistAndFlush(pendingTxn)
        const txn = new AlgoTxn()
        txn.discordId = discordId
        txn.txnType = txnType
        txn.claimResponse = claimResponse
        await this.persistAndFlush(txn)
        return
      }
      pendingTxn.txnType = txnType
      pendingTxn.claimResponse = claimResponse
      await this.persistAndFlush(pendingTxn)
    } else {
      // Log the error
      console.error('No pending txn found something went wrong')
    }
  }
  async addPendingTxn(discordId: string, pendingKarma: number) {
    // Check if there is already a pending txn
    const pendingTxn = await this.findOne({
      discordId,
      txnType: 'pending',
    })
    if (pendingTxn) {
      // If there is a pending txn, update it
      console.error(`Pending txn already exists for ${discordId}`)
      pendingTxn.txnType = 'failed'
      await this.persistAndFlush(pendingTxn)
    }
    // If there is no pending txn, create one
    const txn = new AlgoTxn()
    txn.discordId = discordId
    txn.txnType = 'pending'
    txn.claimResponse = { pendingKarma }
    await this.persistAndFlush(txn)
  }
}
