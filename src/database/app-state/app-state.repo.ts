import { singleton } from 'tsyringe';

import { appState } from './app-state.js';
import { AppState, DataDocument, defaultAppStates } from './app-state.schema.js';

@singleton()
export class AppStateRepository {
  public async getOrInitializeDataDocument(): Promise<DataDocument> {
    const document = await appState.findOneAndUpdate(
      {},
      { $setOnInsert: { ...defaultAppStates } },
      { upsert: true, new: true },
    );
    return document;
  }
  public async readData<K extends keyof AppState>(key: K): Promise<AppState[K]> {
    const document = await this.getOrInitializeDataDocument();

    return document?.[key] ?? defaultAppStates[key];
  }
  public async readDataBulk<K extends keyof AppState>(keys: K[]): Promise<Partial<AppState>> {
    const document = await this.getOrInitializeDataDocument();

    const result: Partial<AppState> = {};

    for (const key of keys) {
      result[key] = document?.[key] ?? defaultAppStates[key];
    }
    return result;
  }

  public async writeData<K extends keyof AppState>(key: K, value: AppState[K]): Promise<void> {
    await appState.updateOne({}, { $set: { [`${key}`]: value } }, { upsert: true });
  }

  public async writeDataBulk(data: Partial<AppState>): Promise<void> {
    const updateQuery: Record<string, unknown> = {};

    for (const key in data) {
      updateQuery[`${key}`] = data[key as keyof AppState];
    }
    await appState.updateOne({}, { $set: updateQuery }, { upsert: true });
  }
}
