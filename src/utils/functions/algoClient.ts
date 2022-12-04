import { algorandConfig } from '@config'
import algosdk, { Account, Indexer } from 'algosdk'

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
 * Get account from mnemonic
 *
 * @export
 * @param {string} mnemonic
 * @returns {*}  {Account}
 */
export function getAccountFromMnemonic(mnemonic: string): Account {
  const cleanedMnemonic = mnemonic
    .replace(/\W/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trimEnd()
    .trimStart()
  return algosdk.mnemonicToSecretKey(cleanedMnemonic)
}
