import * as db from '../db';
import { os } from './os';

export const sendPasswordChanged = os.sendPasswordChanged.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    payload: { ...opts.input },
    template: 'send-password-changed',
  });

  return { jobID: row.id };
});
