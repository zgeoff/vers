import type { ContentDocument } from '@vers/contract-activity';
import type { EmptyErrorPayload } from '../types';

interface GetContentDocumentDeps {
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
}

interface GetContentDocumentOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly contentVersion: string };
}

export async function getContentDocument(
  deps: GetContentDocumentDeps,
  opts: GetContentDocumentOpts,
): Promise<ContentDocument> {
  const document = await deps.loadContentDocument(opts.input.contentVersion);

  if (document === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return document;
}
