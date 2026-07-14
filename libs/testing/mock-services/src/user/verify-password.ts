import * as db from '../db';
import { os } from './os';

export const verifyPassword = os.verifyPassword.handler((opts) => {
  const user = db.userCollection.findFirst((q) => q.where({ email: opts.input.email }));

  return { success: user !== undefined && user.password === opts.input.password };
});
