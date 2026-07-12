import * as db from '../../db';
import { os } from './os';

export const sendResetPassword = os.sendResetPassword.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    ...opts.input,
    template: 'reset-password',
  });

  return { jobID: row.id };
});
