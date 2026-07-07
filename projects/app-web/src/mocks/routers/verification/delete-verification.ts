import { verificationCollection } from '../../db/verification-collection';
import { os } from './os';

export const deleteVerification = os.deleteVerification.handler((opts) => {
  const verification = verificationCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (verification === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  verificationCollection.delete(verification);

  return { deletedID: opts.input.id };
});
