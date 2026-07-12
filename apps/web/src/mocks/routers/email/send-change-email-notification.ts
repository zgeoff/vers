import * as db from '../../db';
import { os } from './os';

export const sendChangeEmailNotification = os.sendChangeEmailNotification.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    ...opts.input,
    template: 'change-email-notification',
  });

  return { jobID: row.id };
});
