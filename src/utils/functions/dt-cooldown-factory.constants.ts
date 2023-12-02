export const GAMES_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
  belowMedianMax: {
    increase: 0,
    decrease: 0.1,
  },
};
export const WALLET_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
  belowMedianMax: {
    increase: 0,
    decrease: 0.4,
  },
};
export const RANK_MEDIAN_MAX: IMedianMaxes = {
  aboveMedianMax: {
    increase: 0,
    decrease: 0.1,
  },
  belowMedianMax: {
    increase: 0.1,
    decrease: 0,
  },
};

export const coolDownBonusFactors = {
  timeMaxPercents: {
    decrease: 1, // 100%
    increase: 0.8, // 80%
  },
  bonusChances: {
    decreaseBaseChance: 0.2,
    increaseBaseChance: 0,
    decreaseMaxChance: 0.8,
    increaseMaxChance: 0.3,
  },
};

export interface IIncreaseDecrease {
  increase: number;
  decrease: number;
}
export interface IMedianMaxes {
  aboveMedianMax: IIncreaseDecrease;
  belowMedianMax: IIncreaseDecrease;
}
