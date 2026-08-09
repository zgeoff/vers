import { MOCK_CONTENT_DOCUMENT } from './mock-content-document';
import { os } from './os';

export const getContentDocument = os.getContentDocument.handler((opts) => {
  if (opts.input.contentVersion !== MOCK_CONTENT_DOCUMENT.contentVersion) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return MOCK_CONTENT_DOCUMENT;
});
