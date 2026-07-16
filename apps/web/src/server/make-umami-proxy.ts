import { UMAMI_PATHS } from '../lib/umami-paths';
import { getClientIPAddress } from './get-client-ip-address';
import type { Middleware } from './middleware';

interface MakeUmamiProxyOptions {
  readonly upstream: string | null;
}

/**
 * Builds the analytics proxy middleware: answers the tracker's same-origin script and beacon
 * paths by forwarding to the Umami deployment, deferring everything else. Beacons carry the
 * client's address in `x-vers-client-ip` — Umami is configured to read that header, so geolocation
 * sees the visitor rather than this server. A `null` upstream disables the proxy and both paths
 * fall through. An unreachable upstream answers 502 — analytics never fails a page.
 */
export function makeUmamiProxy(options: MakeUmamiProxyOptions): Middleware {
  return async (request, next) => {
    if (options.upstream === null) {
      return next();
    }

    const pathname = new URL(request.url).pathname;

    if (request.method === 'GET' && pathname === UMAMI_PATHS.script) {
      return sendUpstream(new URL('/script.js', options.upstream));
    }

    if (request.method === 'POST' && pathname === UMAMI_PATHS.send) {
      const headers = new Headers({
        'content-type': request.headers.get('content-type') ?? 'application/json',
        'x-vers-client-ip': getClientIPAddress(request),
      });

      const userAgent = request.headers.get('user-agent');

      if (userAgent !== null) {
        headers.set('user-agent', userAgent);
      }

      return sendUpstream(new URL('/api/send', options.upstream), {
        body: await request.text(),
        headers,
        method: 'POST',
      });
    }

    return next();
  };
}

interface RelayInit {
  readonly body: string;
  readonly headers: Headers;
  readonly method: 'POST';
}

/**
 * Fetches the upstream target and rewraps the result. fetch responses carry immutable headers,
 * which the server framework must still be able to finalize — and the body arrives already
 * decoded, so the upstream encoding headers no longer describe it. Copy entry by entry: passing
 * another runtime's Headers instance to the constructor can yield an empty copy.
 */
async function sendUpstream(target: URL, init?: RelayInit): Promise<Response> {
  let response: Response;

  // a stalled upstream must not pin request handlers — analytics traffic gives up quickly and the
  // tracker tolerates the loss. The race bounds the wait rather than aborting the socket: signal
  // instances don't survive environments that patch the fetch globals, and the runtime's pool
  // reclaims the connection
  try {
    response = await Promise.race([fetch(target, init), waitUpstreamDeadline()]);
  } catch {
    return new Response(null, { status: 502 });
  }

  const headers = new Headers([...response.headers]);

  headers.delete('content-encoding');
  headers.delete('content-length');

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

// generous enough to cover the upstream's full cold-start chain — Fly machine wake, app boot, and
// the database compute resuming — which a first beacon after an idle period pays all at once;
// dropping that beacon undercounts landings, the funnel's first step
const UPSTREAM_DEADLINE_MS = 15_000;

/**
 * Rejects once the upstream deadline passes; the timer never keeps the process alive.
 */
function waitUpstreamDeadline(): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('analytics upstream deadline exceeded'));
    }, UPSTREAM_DEADLINE_MS);

    timer.unref?.();
  });
}
