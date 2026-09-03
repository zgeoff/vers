import { ContentDocumentSchema } from '@vers/contract-activity';
import type { ContentDocument } from '@vers/contract-activity';
import * as z from 'zod';

type ParseContentDocumentSourceResult =
  | { readonly kind: 'ok'; readonly document: ContentDocument }
  | { readonly kind: 'invalid-json'; readonly message: string }
  | { readonly kind: 'invalid-document'; readonly message: string };

export function parseContentDocumentSource(text: string): ParseContentDocumentSourceResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      kind: 'invalid-json',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const result = ContentDocumentSchema.safeParse(parsed);

  if (!result.success) {
    return { kind: 'invalid-document', message: z.prettifyError(result.error) };
  }

  return { kind: 'ok', document: result.data };
}
