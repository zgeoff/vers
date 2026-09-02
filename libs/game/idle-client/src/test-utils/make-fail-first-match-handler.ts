import { HttpResponse } from 'msw';
import * as z from 'zod';

interface RequestInfo {
  readonly request: Request;
}

const RequestEnvelopeSchema = z.object({ json: z.record(z.string(), z.unknown()).optional() });

export function makeFailFirstMatchHandler(
  matches: (input: Readonly<Record<string, unknown>>) => boolean,
): (info: Readonly<RequestInfo>) => Promise<Response | undefined> {
  let failed = false;

  return async (info): Promise<Response | undefined> => {
    if (failed) {
      return undefined;
    }

    const parsed: unknown = await info.request.clone().json();

    const body = RequestEnvelopeSchema.parse(parsed);

    if (!matches(body.json ?? {})) {
      return undefined;
    }

    failed = true;

    return HttpResponse.error();
  };
}
