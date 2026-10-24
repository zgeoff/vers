import * as db from '../../db';
import { os } from '../os';

export const consumeGrant = os.stepUp.consumeGrant.handler((opts) => {
  const row = db.stepUpGrantCollection.findFirst((query) =>
    query.where({ token: opts.input.token }),
  );

  if (
    row === undefined ||
    row.expiresAt <= new Date() ||
    row.action !== opts.input.action ||
    row.sessionID !== opts.input.sessionID ||
    row.target !== opts.input.target
  ) {
    return { consumed: false };
  }

  db.stepUpGrantCollection.delete(row);

  return { consumed: true };
});
