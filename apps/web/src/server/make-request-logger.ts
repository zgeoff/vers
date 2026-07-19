import type { Middleware } from './middleware';

/**
 * The logger capabilities this middleware needs — satisfied structurally by the app's pino
 * instance without pulling pino's own types into this module's public signature.
 */
interface RequestLoggerSink {
  readonly debug: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly error: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly info: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly warn: (fields: Readonly<Record<string, unknown>>, message: string) => void;
}

/**
 * Builds the request-lifecycle logging middleware: one structured line per request on completion,
 * carrying method, path, status, and duration as queryable fields — data never rides in the
 * message text. The query string never reaches the line: query params carry emailed tokens and
 * auth codes, and a log stream is no place for either. Severity follows outcome: 5xx at error, 4xx
 * at warn, everything else at info — except a served static asset (a pathname with a file
 * extension), which logs at debug to keep asset traffic out of the shipped stream. A handler that
 * throws still logs, at error with the thrown value, before the throw continues to the runtime.
 */
export function makeRequestLogger(logger: RequestLoggerSink): Middleware {
  return async (request, next) => {
    const start = performance.now();

    const path = new URL(request.url).pathname;

    let response: Response;

    try {
      response = await next();
    } catch (error) {
      logger.error(
        {
          durationMs: toDurationMs(performance.now() - start),
          err: error,
          method: request.method,
          path,
        },
        'request failed',
      );

      throw error;
    }

    logger[pickRequestLogLevel(response.status, path)](
      {
        durationMs: toDurationMs(performance.now() - start),
        method: request.method,
        path,
        status: response.status,
      },
      'request completed',
    );

    return response;
  };
}

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i;

function pickRequestLogLevel(status: number, pathname: string): keyof RequestLoggerSink {
  if (status >= 500) {
    return 'error';
  }

  if (status >= 400) {
    return 'warn';
  }

  return ASSET_PATH_PATTERN.test(pathname) ? 'debug' : 'info';
}

/**
 * Rounds an elapsed-time reading to one decimal, keeping the sub-millisecond resolution that
 * whole-millisecond rounding would discard.
 */
function toDurationMs(elapsedMs: number): number {
  return Math.round(elapsedMs * 10) / 10;
}
