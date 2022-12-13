import { Store as RxStore } from 'rxeta';
import { singleton } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';

interface State {
    totalGames: number;
    rankedAssets: AlgoNFTAsset[];
}

const initialState: State = {
    totalGames: 0,
    rankedAssets: [],
};

@singleton()
export class Ranking extends RxStore<State> {
    constructor() {
        super(initialState);
    }
}
