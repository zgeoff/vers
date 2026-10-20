import type { ContentDocument } from '@vers/contract-activity';
import type { EmptyErrorPayload } from '../types';

interface ReadContentDocumentDeps {
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
}

interface ReadContentDocumentOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly contentVersion: string };
}

export async function readContentDocument(
  deps: ReadContentDocumentDeps,
  opts: ReadContentDocumentOpts,
): Promise<ContentDocument> {
  const document = await deps.loadContentDocument(opts.input.contentVersion);

  if (document === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return document;
}
