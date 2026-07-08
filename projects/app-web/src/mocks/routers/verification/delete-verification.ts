import * as db from '../../db';
import { os } from './os';

export const deleteVerification = os.deleteVerification.handler((opts) => {
  const verification = db.verificationCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (verification === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  db.verificationCollection.delete(verification);

  return { deletedID: opts.input.id };
});
