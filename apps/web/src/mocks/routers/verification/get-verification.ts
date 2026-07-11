import * as db from '../../db';
import { os } from './os';

export const getVerification = os.getVerification.handler((opts) => {
  const verification = db.verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: opts.input.type }),
  );

  return verification ?? null;
});
