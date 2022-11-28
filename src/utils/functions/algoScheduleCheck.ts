import { AlgoWallet, Data } from '@entities'
import { Algorand, Database } from '@services'
import {
  moreThanTwentyFourHoursAgo,
  resolveDependencies,
  resolveDependency,
} from '@utils/functions'

export const isUserAssetsSynced = async (): Promise<void> => {
  const [db, algorand] = await resolveDependencies([Database, Algorand])

  const dataRepository = db.get(Data)
  const userAssetSyncData = await dataRepository.get('userAssetSync')
  const lastSync = moreThanTwentyFourHoursAgo(userAssetSyncData)
  if (lastSync) {
    await algorand.userAssetSync()
  }
}
export const isCreatorAssetsSynced = async (): Promise<void> => {
  const [db, algorand] = await resolveDependencies([Database, Algorand])
  const dataRepository = db.get(Data)
  const creatorAssetSyncData = await dataRepository.get('creatorAssetSync')
  const lastSync = moreThanTwentyFourHoursAgo(creatorAssetSyncData)
  if (lastSync) {
    await algorand.creatorAssetSync()
  }
}
export const updateCreatorAssetSync = async (): Promise<void> => {
  const db = await resolveDependency(Database)
  const dataRepository = db.get(Data)
  await dataRepository.set('creatorAssetSync', Date.now())
}
export const updateUserAssetSync = async (): Promise<void> => {
  const db = await resolveDependency(Database)
  const dataRepository = db.get(Data)
  await dataRepository.set('userAssetSync', Date.now())
}
export const createNPCs = async (): Promise<void> => {
  const db = await resolveDependency(Database)
  const algoWallet = db.get(AlgoWallet)
  await algoWallet.createBotNPCs()
}
