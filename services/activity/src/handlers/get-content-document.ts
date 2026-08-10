import type { ContentDocument } from '@vers/contract-activity';
import type { EmptyErrorPayload } from '../types';

interface GetContentDocumentDeps {
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
}

/**
 * oRPC handler opts for the authed `getContentDocument` procedure.
 */
interface GetContentDocumentOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly contentVersion: string };
}

/**
 * Returns a published content version's document. Content is not owner-scoped — every caller past
 * the s2s trust boundary this route sits behind may fetch any published version.
 */
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
