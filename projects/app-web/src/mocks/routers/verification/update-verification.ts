import { verificationCollection } from '../../db/verification-collection';
import { os } from './os';

export const updateVerification = os.updateVerification.handler(async (opts) => {
  const verification = verificationCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (verification === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (opts.input.type !== undefined) {
    const type = opts.input.type;

    await verificationCollection.update(verification, {
      data(record) {
        record.type = type;
      },
    });
  }

  return { updatedID: opts.input.id };
});
