import { model } from 'mongoose';

import { appStateSchema, IAppState } from './app-state.schema.js';

// Define the model
export const appStateModel = model<IAppState>('AppState', appStateSchema);
