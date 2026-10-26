import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { activityContract } from '@vers/contract-activity';
import { makeIsRetryable, makeRetryInterceptor } from '@vers/service-utils/orpc';
import type { CallRecord, CookieJar, PlayerClient } from './types';

interface CreatePlayerClientOptions {
  readonly appURL: string;
  readonly jar: CookieJar;
  readonly onCall: (record: CallRecord) => void;
}

// the browser's activity client: app-web's RPC proxy behind the session cookie, with the client's
// own retry policy, so a call the load generator counts as failed is one a player sees fail
export function createPlayerClient(options: Readonly<CreatePlayerClientOptions>): PlayerClient {
  const sendRequest = async (input: Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);

    const procedure = new URL(request.url).pathname.split('/').at(-1) ?? 'unknown';

    request.headers.set('cookie', options.jar.header);

    const startedAt = performance.now();

    try {
      const response = await fetch(request);

      updateJar(options.jar, response.headers.getSetCookie());

      options.onCall({
        durationMs: performance.now() - startedAt,
        procedure,
        status: response.status,
      });

      return response;
    } catch (error) {
      options.onCall({ durationMs: performance.now() - startedAt, procedure, status: 0 });
      throw error;
    }
  };

  const isRetryable = makeIsRetryable(activityContract);

  return createORPCClient(
    new RPCLink({
      clientInterceptors: [makeRetryInterceptor({ isRetryable })],
      fetch: sendRequest,
      url: `${options.appURL}/api/rpc/activity`,
    }),
  );
}

// app-web rewrites the cookie when it refreshes an expired access token
function updateJar(jar: CookieJar, setCookies: ReadonlyArray<string>): void {
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';', 1);

    if (pair?.startsWith(`${jar.name}=`) === true) {
      jar.header = pair;
    }
  }
}
