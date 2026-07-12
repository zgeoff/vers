import * as db from '../../db';
import { os } from './os';

export const sendChangeEmailVerification = os.sendChangeEmailVerification.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({
    ...opts.input,
    template: 'change-email-verification',
  });

  return { jobID: row.id };
});
