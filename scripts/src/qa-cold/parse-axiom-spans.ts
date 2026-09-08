import { z } from 'zod';
import type { RequestSpan } from './types';

const responseAttributesSchema = z.object({ status_code: z.number().nullish() }).nullish();
const httpAttributesSchema = z.object({ response: responseAttributesSchema }).nullish();
const urlAttributesSchema = z.object({ path: z.string().nullish() }).nullish();

const attributesSchema = z
  .object({ http: httpAttributesSchema, url: urlAttributesSchema })
  .nullish();

const serviceSchema = z.object({ name: z.string().nullish() }).nullish();

const spanDataSchema = z.object({
  attributes: attributesSchema,
  name: z.string(),
  service: serviceSchema,
  trace_id: z.string(),
});

const matchSchema = z.object({ data: spanDataSchema });
const legacyResultSchema = z.object({ matches: z.array(matchSchema).nullish() });

export function parseAxiomSpans(json: unknown): Array<RequestSpan> {
  const result = legacyResultSchema.parse(json);

  return (result.matches ?? []).map((match) => ({
    name: match.data.name,
    path: match.data.attributes?.url?.path ?? null,
    service: match.data.service?.name ?? 'unknown',
    statusCode: match.data.attributes?.http?.response?.status_code ?? null,
    traceID: match.data.trace_id,
  }));
}
