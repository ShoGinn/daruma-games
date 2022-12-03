import { algorandConfig } from '@config'
import algosdk, { Account, Algodv2, Indexer } from 'algosdk'

export function getAlgodConnectionConfiguration() {
  // Purestake uses a slightly different API key header than the default
  // We are using Purestake to talk to testnet and mainnet so we don't have to stand up our own node
  const algodServer =
    process.env.ALGOD_SERVER || algorandConfig.defaultAlgoApi.main
  const algodPort = process.env.ALGOD_PORT ?? ''
  const algodToken = algodServer.includes('purestake.io')
    ? { 'X-API-Key': process.env.ALGO_PURESTAKE_API_TOKEN }
    : process.env.ALGOD_TOKEN
  return {
    algodToken,
    algodServer,
    algodPort,
  }
}

export function getIndexerConnectionConfiguration() {
  // Purestake uses a slightly different API key header than the default
  // We are using Purestake to talk to testnet and mainnet so we don't have to stand up our own node
  const indexerServer =
    process.env.INDEXER_SERVER || algorandConfig.defaultAlgoApi.indexer
  const indexerPort = process.env.INDEXER_PORT ?? ''
  const indexerToken = indexerServer.includes('purestake.io')
    ? { 'X-API-Key': process.env.ALGO_PURESTAKE_API_TOKEN }
    : process.env.INDEXER_TOKEN
  return {
    indexerToken,
    indexerServer,
    indexerPort,
  }
}

export function getAlgoClient(): algosdk.Algodv2 {
  const { algodToken, algodServer, algodPort } =
    getAlgodConnectionConfiguration()
  return new algosdk.Algodv2(algodToken, algodServer, algodPort)
}

export function getIndexerClient(): algosdk.Indexer {
  const { indexerToken, indexerServer, indexerPort } =
    getIndexerConnectionConfiguration()
  return new Indexer(indexerToken, indexerServer, indexerPort)
}
/**
 * Wait until the transaction is confirmed or rejected, or until 'timeout'
 * number of rounds have passed.
 * @param {algosdk.Algodv2} client the Algod V2 client
 * @param {string} txId the transaction ID to wait for
 * @param {number} timeout maximum number of rounds to wait
 * @returns {*}  {Promise<PendingTransactionResponse>}
 * @throws Throws an error if the transaction is not confirmed or rejected in the next timeout rounds
 * https://developer.algorand.org/docs/sdks/javascript/
 */
export async function waitForConfirmation(
  client: Algodv2,
  txId: string,
  timeout: number
): Promise<AlgorandPlugin.PendingTransactionResponse> {
  if (client == null || txId == null || timeout < 0) {
    throw new Error('Bad arguments')
  }

  const status = await client.status().do()
  if (status === undefined) {
    throw new Error('Unable to get node status')
  }

  const startRound = <number>status['last-round'] + 1
  let currentRound = startRound

  while (currentRound < startRound + timeout) {
    const pendingInfo = (await client
      .pendingTransactionInformation(txId)
      .do()) as AlgorandPlugin.PendingTransactionResponse
    if (pendingInfo !== undefined) {
      const confirmedRound = pendingInfo['confirmed-round']
      if (confirmedRound && confirmedRound > 0) {
        return pendingInfo
      } else {
        const poolError = pendingInfo['pool-error']
        if (poolError != null && poolError.length > 0) {
          // If there was a pool error, then the transaction has been rejected!
          throw new Error(
            `Transaction ${txId} rejected - pool error: ${poolError}`
          )
        }
      }
    }
    await client.statusAfterBlock(currentRound).do()
    currentRound++
  }
  throw new Error(`Transaction ${txId} not confirmed after ${timeout} rounds!`)
}

/**
 * Get account from mnemonic
 *
 * @export
 * @param {string} mnemonic
 * @returns {*}  {Account}
 */
export function getAccountFromMnemonic(mnemonic: string): Account {
  return algosdk.mnemonicToSecretKey(mnemonic)
}
