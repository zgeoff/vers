import { PassThrough } from 'node:stream';
import { styleText } from 'node:util';
import { createReadableStreamFromReadable } from '@react-router/node';
import * as Sentry from '@sentry/node';
import type { Client } from '@urql/core';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import type {
  ActionFunctionArgs,
  AppLoadContext,
  EntryContext,
  LoaderFunctionArgs,
} from 'react-router';
import { ServerRouter } from 'react-router';
import { createTimings } from './utils/create-timings.server';
import { getServerTimingHeader } from './utils/get-server-timing-header.server';
import { NonceProvider } from './utils/nonce-provider';

export const streamTimeout = 5000;

// mock the network in dev and the e2e build, never in production — gating on
// the build mode (not just the flag) keeps a stray VITE_ENABLE_MSW out of a
// production bundle
if (import.meta.env.MODE !== 'production' && import.meta.env.VITE_ENABLE_MSW === 'true') {
  const { server } = await import('./mocks/node');

  server.listen();
}

// if we're in dev mode, load our local environment variables which should include our server secrets
if (!import.meta.env.PROD) {
  process.loadEnvFile('.env.development.local');
}

declare module 'react-router' {
  interface AppLoadContext {
    client: Client;
    cspNonce: string;
  }

  interface unstable_RouterContext {
    client: Client;
  }
}

export default function handleRequest(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  request: Request,
  responseStatusCode: number,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  responseHeaders: Headers,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  reactRouterContext: EntryContext,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  loadContext: AppLoadContext,
) {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (process.env['NODE_ENV'] === 'production' && process.env['SENTRY_DSN']) {
    responseHeaders.append('Document-Policy', 'js-profiling');
  }

  const callbackName = isbot(request.headers.get('user-agent')) ? 'onAllReady' : 'onShellReady';

  return new Promise((resolve, reject) => {
    let didError = false;

    // NOTE: this timing will only include things that are rendered in the shell
    // and will not include suspended components and deferred loaders
    const timings = createTimings('render', 'renderToPipeableStream');

    const { abort, pipe } = renderToPipeableStream(
      <NonceProvider value={loadContext.cspNonce}>
        <ServerRouter context={reactRouterContext} nonce={loadContext.cspNonce} url={request.url} />
      </NonceProvider>,
      {
        [callbackName]: () => {
          const body = new PassThrough();

          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.append('Server-Timing', getServerTimingHeader(timings));

          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            }),
          );

          pipe(body);
        },
        nonce: loadContext.cspNonce,
        onError: () => {
          didError = true;
        },
        onShellError: (err: unknown) => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
          reject(err as Error);
        },
      },
    );

    setTimeout(abort, streamTimeout + 5000);
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function handleError(error: unknown, args: ActionFunctionArgs | LoaderFunctionArgs) {
  // Skip capturing if the request is aborted as Remix docs suggest
  // Ref: https://remix.run/docs/en/main/file-conventions/entry.server#handleerror
  if (args.request.signal.aborted) {
    return;
  }

  if (error instanceof Error) {
    console.error(styleText('red', String(error.stack)));
  } else {
    console.error(error);
  }

  Sentry.captureException(error);
}
