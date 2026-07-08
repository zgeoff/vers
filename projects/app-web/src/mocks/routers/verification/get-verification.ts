import { verificationCollection } from '../../db/verification-collection';
import { os } from './os';

export const getVerification = os.getVerification.handler((opts) => {
  const verification = verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: opts.input.type }),
  );

  return verification ?? null;
});
