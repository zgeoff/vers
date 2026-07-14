import * as db from '../db';
import { os } from './os';

export const sendChangeEmailVerification = os.sendChangeEmailVerification.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    payload: { ...opts.input },
    template: 'send-change-email-verification',
  });

  return { jobID: row.id };
});
