import * as db from '../db';
import { os } from './os';

export const sendChangeEmailNotification = os.sendChangeEmailNotification.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    payload: { ...opts.input },
    template: 'send-change-email-notification',
  });

  return { jobID: row.id };
});
