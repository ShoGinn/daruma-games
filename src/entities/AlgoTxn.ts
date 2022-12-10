import { Entity, EntityRepositoryType, PrimaryKey, Property } from '@mikro-orm/core';
import { EntityRepository } from '@mikro-orm/mysql';

import { txnTypes } from '../enums/dtEnums.js';
import { CustomBaseEntity } from './BaseEntity.js';

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => AlgoTxnRepository })
export class AlgoTxn extends CustomBaseEntity {
    [EntityRepositoryType]?: AlgoTxnRepository;

    @PrimaryKey()
    id: number;

    @Property()
    discordId: string;

    @Property()
    txnType: string;

    @Property({ type: 'json', nullable: true })
    claimResponse?: any;
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class AlgoTxnRepository extends EntityRepository<AlgoTxn> {
    /**
     * Add an algo txn to the database
     *
     * @param {string} discordId
     * @param {txnTypes} txnType
     * @param {*} [claimResponse]
     * @returns {*}  {Promise<void>}
     * @memberof AlgoTxnRepository
     */
    async addTxn(
        discordId: string,
        txnType: txnTypes,
        claimResponse?: AlgorandPlugin.ClaimTokenResponse
    ): Promise<void> {
        // fetch pending txn within the last 5 minutes
        const pendingTxn = await this.findOne({
            discordId,
            txnType: txnTypes.PENDING,
            createdAt: {
                $gt: new Date(new Date().getTime() - 5 * 60 * 1000),
            },
        });
        // if pending txn exists, update it
        if (pendingTxn) {
            if (claimResponse?.status?.txn.txn.aamt !== pendingTxn.claimResponse.pendingKarma) {
                console.error(
                    'Pending txn amount does not match claim response amount -- Adding new txn'
                );
                console.error(
                    `Expected ${pendingTxn.claimResponse.pendingKarma} but got ${claimResponse?.status?.txn.txn.aamt}`
                );
                pendingTxn.txnType = txnTypes.FAILED;
                await this.persistAndFlush(pendingTxn);
                const txn = new AlgoTxn();
                txn.discordId = discordId;
                txn.txnType = txnType;
                txn.claimResponse = claimResponse;
                await this.persistAndFlush(txn);
                return;
            }
            pendingTxn.txnType = txnType;
            pendingTxn.claimResponse = claimResponse;
            await this.persistAndFlush(pendingTxn);
        } else {
            // Log the error
            console.error('No pending txn found something went wrong');
        }
    }
    async addPendingTxn(discordId: string, pendingKarma: number): Promise<void> {
        // Check if there is already a pending txn
        const pendingTxn = await this.findOne({
            discordId,
            txnType: txnTypes.PENDING,
        });
        if (pendingTxn) {
            // If there is a pending txn, update it
            console.error(`Pending txn already exists for ${discordId}`);
            pendingTxn.txnType = txnTypes.FAILED;
            await this.persistAndFlush(pendingTxn);
        }
        // If there is no pending txn, create one
        const txn = new AlgoTxn();
        txn.discordId = discordId;
        txn.txnType = txnTypes.PENDING;
        txn.claimResponse = { pendingKarma };
        await this.persistAndFlush(txn);
    }
}
