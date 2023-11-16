import { model } from 'mongoose';

import { IUser, userSchema } from './user.schema.js';

export const userModel = model<IUser>('User', userSchema);
