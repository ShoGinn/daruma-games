import { DarumaTrainingEncounters } from '../../src/database/dt-encounter/dt-encounters.schema.js';

export const oneVsNpcNpcWinner = {
  _id: {
    $oid: '6541b4137868eb4979cbf030',
  },
  channelId: '1042494903218880532',
  gameType: 'OneVsNpc',
  gameData: {
    '3': {
      rolls: [2, 2, 3, 3, 3, 4, 2, 4, 2, 5, 3, 1, 2],
    },
    '10002': {
      rolls: [3, 3, 5, 5, 5, 1, 4, 2, 3, 5, 1, 4, 2, 1, 5, 4, 2, 4, 5, 2, 1, 3, 3],
    },
  },
  __v: 0,
  dt: {
    $date: '2022-11-28T09:38:29.000Z',
  },
} as unknown as DarumaTrainingEncounters;

export const oneVsNPCPlayerWinner = {
  _id: {
    $oid: '6541b4137868eb4979cbf030',
  },
  channelId: '1042494903218880532',
  gameType: 'OneVsNpc',
  gameData: {
    '3': {
      rolls: [3, 3, 5, 5, 5, 1, 4, 2, 3, 5, 1, 4, 2, 1, 5, 4, 2, 4, 5, 2, 1, 3, 3],
    },
    '10001': {
      rolls: [2, 2, 3, 3, 3, 4, 2, 4, 2, 5, 3, 1, 2],
    },
  },
  __v: 0,
  dt: {
    $date: '2022-11-28T09:38:29.000Z',
  },
} as unknown as DarumaTrainingEncounters;
export const fourVsNpcPlayerWinner = {
  _id: {
    $oid: '6541b4167868eb4979cbf075',
  },
  channelId: '1042495147964899328',
  gameType: 'FourVsNpc',
  gameData: {
    '4': {
      rolls: [1, 2, 1, 3, 3, 1, 4, 3, 4, 1, 3, 2, 4, 1],
    },
    '40001': {
      rolls: [3, 5, 3, 2, 5, 3, 3, 5, 5],
    },
    '40002': {
      rolls: [3, 2, 4, 3, 1, 2, 1, 3, 5, 4, 5, 2],
    },
    '40003': {
      rolls: [5, 3, 5, 4, 1, 4, 3, 4, 4, 4],
    },
    '40004': {
      rolls: [3, 5, 5, 2, 2, 1, 5, 3, 1, 3, 5, 5, 4, 2],
    },
  },
  __v: 0,
  dt: {
    $date: '2022-11-28T09:53:32.000Z',
  },
} as unknown as DarumaTrainingEncounters;

export const oneVsOneZen = {
  _id: {
    $oid: '6541b4147868eb4979cbf042',
  },
  channelId: '1042494960605351946',
  gameType: 'OneVsOne',
  gameData: {
    '11001': {
      rolls: [5, 5, 5, 3, 1, 5, 3, 1, 5],
    },
    '11002': {
      rolls: [5, 5, 5, 3, 1, 5, 3, 1, 5],
    },
  },
  __v: 0,
  dt: {
    $date: '2022-11-28T09:42:13.000Z',
  },
} as unknown as DarumaTrainingEncounters;
