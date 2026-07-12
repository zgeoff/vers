import * as db from '../../db';
import { os } from './os';

export const sendWelcome = os.sendWelcome.handler(async (opts) => {
  const row = await db.sentEmailCollection.create({ ...opts.input, template: 'welcome' });

  return { jobID: row.id };
});
