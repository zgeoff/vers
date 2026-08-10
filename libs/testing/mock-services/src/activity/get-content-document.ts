import * as db from '../db';
import { os } from './os';

export const getContentDocument = os.getContentDocument.handler((opts) => {
  const document = db.contentDocumentCollection.findFirst((q) =>
    q.where({ contentVersion: opts.input.contentVersion }),
  );

  if (document === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return document;
});
