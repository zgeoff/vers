import * as db from '../../db';
import { os } from './os';

export const sendExistingAccount = os.sendExistingAccount.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    payload: { ...opts.input },
    template: 'send-existing-account',
  });

  return { jobID: row.id };
});
