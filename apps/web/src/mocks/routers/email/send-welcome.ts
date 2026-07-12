import * as db from '../../db';
import { os } from './os';

export const sendWelcome = os.sendWelcome.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    payload: { ...opts.input },
    template: 'send-welcome',
  });

  return { jobID: row.id };
});
