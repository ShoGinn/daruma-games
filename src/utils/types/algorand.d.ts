declare namespace AlgorandPlugin {
    // https://developer.algorand.org/docs/rest-apis/indexer/#get-v2transactions
    type TransactionSearchResults = {
        'current-round': string;
        'next-token': string;
        transactions: Array<TransactionResult>;
    };

    type TransactionResult = {
        id: string;
        fee: number;
        sender: string;
        'first-valid': number;
        'last-valid': number;
        'confirmed-round'?: number;
        group?: string;
        note?: string;
        logs?: Array<string>;
        'round-time'?: number;
        'intra-round-offset'?: number;
        signature?: TransactionSignature;
        'application-transaction'?: any;
        'created-application-index'?: number;
        'asset-config-transaction': AssetConfigTransactionResult;
        'created-asset-index'?: number;
        'asset-freeze-transaction'?: AssetFreezeTransactionResult;
        'asset-transfer-transaction'?: AssetTransferTransactionResult;
        'keyreg-transaction'?: any;
        'payment-transaction'?: PaymentTransactionResult;
        'auth-addr'?: string;
        'closing-amount'?: number;
        'genesis-hash'?: string;
        'genesis-id'?: string;
        'inner-txns'?: Array<TransactionResult>;
        'rekey-to'?: string;
        lease?: string;
        'local-state-delta'?: Array<Record<string, EvalDelta>>;
        'global-state-delta'?: Array<Record<string, EvalDelta>>;
        'receiver-rewards'?: number;
        'sender-rewards'?: number;
        'close-rewards'?: number;
        'tx-type': import('algosdk').TransactionType;
    };

    type TransactionSignature = {
        logicsig: LogicTransactionSignature;
        multisig: MultisigTransactionSignature;
        sig: string;
    };

    type LogicTransactionSignature = {
        args: Array<string>;
        logic: string;
        'multisig-signature': MultisigTransactionSignature;
        signature: string;
    };

    type MultisigTransactionSignature = {
        subsignature: MultisigTransactionSubSignature;
        threshold: number;
        version: number;
    };

    type MultisigTransactionSubSignature = {
        'public-key': string;
        signature: string;
    };

    type EvalDelta = {
        action: number;
        bytes: string;
        uint: number;
    };

    type StateSchema = {
        'num-byte-slice': number;
        'num-uint': number;
    };

    type AssetConfigTransactionResult = {
        'asset-id': number;
        params: AssetParams;
    };

    type AssetFreezeTransactionResult = {
        address: string;
        'asset-id': number;
        'new-freeze-status': boolean;
    };

    type AssetTransferTransactionResult = {
        amount: number;
        'asset-id': number;
        'close-amount'?: number;
        'close-to'?: string;
        receiver?: string;
        sender?: string;
    };

    type AssetResult = {
        index: number;
        deleted?: boolean;
        'created-at-round': number;
        'deleted-at-round': number;
        params: AssetParams;
    };

    type AssetParams = {
        /**
         * The address that created this asset. This is the address where the parameters
         * for this asset can be found, and also the address where unwanted asset units can
         * be sent in the worst case.
         */
        creator: string;
        /**
         * (dc) The number of digits to use after the decimal point when displaying this
         * asset. If 0, the asset is not divisible. If 1, the base unit of the asset is in
         * tenths. If 2, the base unit of the asset is in hundredths, and so on. This value
         * must be between 0 and 19 (inclusive).
         */
        decimals: number;
        /**
         * (t) The total number of units of this asset.
         */
        total: number | bigint;
        /**
         * (c) Address of account used to clawback holdings of this asset. If empty,
         * clawback is not permitted.
         */
        clawback?: string;
        /**
         * (df) Whether holdings of this asset are frozen by default.
         */
        'default-frozen'?: boolean;
        /**
         * (f) Address of account used to freeze holdings of this asset. If empty, freezing
         * is not permitted.
         */
        freeze?: string;
        /**
         * (m) Address of account used to manage the keys of this asset and to destroy it.
         */
        manager?: string;
        /**
         * (am) A commitment to some unspecified asset metadata. The format of this
         * metadata is up to the application.
         */
        'metadata-hash'?: Uint8Array;
        /**
         * (an) Name of this asset, as supplied by the creator. Included only when the
         * asset name is composed of printable utf-8 characters.
         */
        name?: string;
        /**
         * Base64 encoded name of this asset, as supplied by the creator.
         */
        'name-b64'?: Uint8Array;
        /**
         * (r) Address of account holding reserve (non-minted) units of this asset.
         */
        reserve?: string;
        /**
         * (un) Name of a unit of this asset, as supplied by the creator. Included only
         * when the name of a unit of this asset is composed of printable utf-8 characters.
         */
        'unit-name'?: string;
        /**
         * Base64 encoded name of a unit of this asset, as supplied by the creator.
         */
        'unit-name-b64'?: Uint8Array;
        /**
         * (au) URL where more information about the asset can be retrieved. Included only
         * when the URL is composed of printable utf-8 characters.
         */
        url?: string;
        /**
         * Base64 encoded URL where more information about the asset can be retrieved.
         */
        'url-b64'?: Uint8Array;
    };

    type PaymentTransactionResult = {
        amount: number;
        'close-amount'?: number;
        'close-remainder-to'?: string;
        receiver: string;
    };

    type Arc69Payload = {
        standard: 'arc69';
        description?: string;
        external_url?: string;
        media_url?: string;
        properties?:
            | {
                  [key: string]:
                      | number
                      | Array<number>
                      | string
                      | Array<string>
                      | { [key: string]: number | Array<number> | string | Array<string> };
              }
            | undefined;
        mime_type?: string;
    };
    // https://developer.algorand.org/docs/rest-apis/indexer/#get-v2accountsaccount-idcreated-assets
    type AssetsCreatedLookupResult = {
        'current-round': string;
        'next-token': string;
        assets: Array<AssetResult>;
    };
    type AssetLookupResult = {
        'current-round': string;
        asset: AssetResult;
    };
    // https://developer.algorand.org/docs/rest-apis/indexer/#assetholding
    type AssetHolding = {
        /** [a] number of units held. */
        amount: number;
        /** Asset ID of the holding. */
        'asset-id': number;
        /** Whether or not the asset holding is currently deleted from its account. */
        deleted?: boolean;
        /** [f] whether or not the holding is frozen. */
        'is-frozen': boolean;
        /** Round during which the account opted into this asset holding. */
        'opted-in-at-round'?: number;
        /** Round during which the account opted out of this asset holding. */
        'opted-out-at-round'?: number;
    };

    type AssetsLookupResult = {
        'current-round': string;
        'next-token': string;
        assets: Array<AssetHolding>;
    };

    // https://developer.algorand.org/docs/rest-apis/algod/v2/#get-v2transactionspendingtxid
    type PendingTransactionResponse = {
        'pool-error': string;
        /**
         * The raw signed transaction.
         */
        txn: import('algosdk').EncodedSignedTransaction;
        /**
         * The application index if the transaction was found and it created an
         * application.
         */
        'application-index'?: number;
        /**
         * The number of the asset's unit that were transferred to the close-to address.
         */
        'asset-closing-amount'?: number;
        /**
         * The asset index if the transaction was found and it created an asset.
         */
        'asset-index'?: number;
        /**
         * Rewards in microalgos applied to the close remainder to account.
         */
        'close-rewards'?: number;
        /**
         * Closing amount for the transaction.
         */
        'closing-amount'?: number;
        /**
         * The round where this transaction was confirmed, if present.
         */
        'confirmed-round'?: number;
        /**
         * (gd) Global state key/value changes for the application being executed by this
         * transaction.
         */
        'global-state-delta'?: Array<Record<string, EvalDelta>>;
        /**
         * Inner transactions produced by application execution.
         */
        'inner-txns'?: Array<PendingTransactionResponse>;
        /**
         * (ld) Local state key/value changes for the application being executed by this
         * transaction.
         */
        'local-state-delta'?: Array<Record<string, EvalDelta>>;
        /**
         * (lg) Logs for the application being executed by this transaction.
         */
        logs?: Array<Uint8Array>;
        /**
         * Rewards in microalgos applied to the receiver account.
         */
        'receiver-rewards'?: number;
        /**
         * Rewards in microalgos applied to the sender account.
         */
        'sender-rewards'?: number;
    };

    type ClaimTokenResponse = {
        status?: PendingTransactionResponse;
        txId?: string;
        error?: string;
    };
    type dbTxn = {
        txId?: string;
        aamt?: any;
    };
}
