import { model } from 'mongoose';

import { appStateSchema, IAppState } from './app-state.schema.js';

// Define the model
export const appState = model<IAppState>('AppState', appStateSchema);
