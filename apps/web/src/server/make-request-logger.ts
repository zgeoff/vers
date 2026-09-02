import type { Middleware } from './middleware';

interface RequestLoggerSink {
  readonly debug: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly error: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly info: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly warn: (fields: Readonly<Record<string, unknown>>, message: string) => void;
}

export function makeRequestLogger(logger: RequestLoggerSink): Middleware {
  return async (request, next) => {
    const start = performance.now();

    // the query string never reaches the log line: query params carry emailed reset tokens and codes
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

function toDurationMs(elapsedMs: number): number {
  return Math.round(elapsedMs * 10) / 10;
}
