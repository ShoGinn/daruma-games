import { AlgoNFTAsset } from '@entities'
import { Store as RxStore } from 'rxeta'
import { singleton } from 'tsyringe'

interface State {
  totalGames: number
  rankedAssets: AlgoNFTAsset[]
}

const initialState: State = {
  totalGames: 0,
  rankedAssets: [],
}

@singleton()
export class Ranking extends RxStore<State> {
  constructor() {
    super(initialState)
  }
}
