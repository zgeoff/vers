import type { Middleware } from './middleware';

interface RequestLoggerSink {
  readonly debug: (message: string, properties: Readonly<Record<string, unknown>>) => void;
  readonly error: (message: string, properties: Readonly<Record<string, unknown>>) => void;
  readonly info: (message: string, properties: Readonly<Record<string, unknown>>) => void;
  readonly warn: (message: string, properties: Readonly<Record<string, unknown>>) => void;
}

interface RequestLoggerOptions {
  readonly overdueRequestMs?: number;
}

const DEFAULT_OVERDUE_REQUEST_MS = 30_000;

export function makeRequestLogger(
  logger: RequestLoggerSink,
  options: Readonly<RequestLoggerOptions> = {},
): Middleware {
  const overdueRequestMs = options.overdueRequestMs ?? DEFAULT_OVERDUE_REQUEST_MS;

  return async (request, next) => {
    const start = performance.now();

    // the query string never reaches the log line: query params carry emailed reset tokens and codes
    const path = new URL(request.url).pathname;

    // written while the request is still open: a span exports only once it ends, so a request
    // that never finishes leaves this line as its only trace
    const overdue = setTimeout(() => {
      logger.warn('request overdue', { elapsedMs: overdueRequestMs, method: request.method, path });
    }, overdueRequestMs);

    let response: Response;

    try {
      response = await next();
    } catch (error) {
      if (request.signal.aborted) {
        logger.info('request aborted', {
          durationMs: toDurationMs(performance.now() - start),
          method: request.method,
          path,
        });

        throw error;
      }

      logger.error('request failed', {
        durationMs: toDurationMs(performance.now() - start),
        error,
        method: request.method,
        path,
      });

      throw error;
    } finally {
      clearTimeout(overdue);
    }

    logger[pickRequestLogLevel(response.status, path)]('request completed', {
      durationMs: toDurationMs(performance.now() - start),
      method: request.method,
      path,
      status: response.status,
    });

    return response;
  };
}

function toDurationMs(elapsedMs: number): number {
  return Math.round(elapsedMs * 10) / 10;
}

const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/iu;

function pickRequestLogLevel(status: number, pathname: string): keyof RequestLoggerSink {
  if (status >= 500) {
    return 'error';
  }

  if (status >= 400) {
    return 'warn';
  }

  return ASSET_PATH_PATTERN.test(pathname) ? 'debug' : 'info';
}
