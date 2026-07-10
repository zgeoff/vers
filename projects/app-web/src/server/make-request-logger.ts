import type { Middleware } from './middleware';

const ANSI = {
  bold: '[1m',
  cyan: '[36m',
  green: '[32m',
  red: '[31m',
  reset: '[0m',
  yellow: '[33m',
} as const;

/**
 * The one logger capability this middleware needs — satisfied structurally by the app's pino
 * instance without pulling pino's own types into this module's public signature.
 */
interface RequestLoggerSink {
  readonly info: (message: string) => void;
}

/**
 * Builds the request-lifecycle logging middleware: one line as a request starts, one line with
 * its status and duration once it finishes, both colorized by method and status for readable
 * console output.
 */
export function makeRequestLogger(logger: RequestLoggerSink): Middleware {
  return async (request, next) => {
    const start = performance.now();
    const path = formatRequestPath(new URL(request.url));

    logger.info(`${ANSI.bold}[<---]${ANSI.reset} ${request.method} ${path} processing...`);

    const response = await next();

    const duration = performance.now() - start;
    const methodColor = request.method === 'GET' ? ANSI.green : ANSI.yellow;
    const methodStyled = `${ANSI.bold}${methodColor}${request.method}${ANSI.reset}`;
    const statusColor = pickStatusColor(response.status);
    const statusStyled = `${statusColor}${response.status}${ANSI.reset}`;
    const statusLabel = pickStatusLabel(response.status);

    logger.info(
      `${ANSI.bold}[${statusLabel}]${ANSI.reset} ${methodStyled} ${path} ${statusStyled} (${formatDuration(duration)})`,
    );

    return response;
  };
}

function pickStatusColor(status: number): string {
  if (status >= 200 && status < 300) {
    return ANSI.green;
  }

  if (status >= 400 && status < 500) {
    return ANSI.yellow;
  }

  if (status >= 500) {
    return ANSI.red;
  }

  return ANSI.cyan;
}

function pickStatusLabel(status: number): string {
  if (status >= 200 && status < 300) {
    return '--->';
  }

  if (status >= 400 && status < 500) {
    return 'CLIENT ERROR';
  }

  if (status >= 500) {
    return 'SERVER ERROR';
  }

  return 'OTHER';
}

function formatRequestPath(url: URL): string {
  return url.pathname + url.search;
}

function formatDuration(duration: number): string {
  if (duration < 1000) {
    return `${duration.toFixed(2)}ms`;
  }

  if (duration < 60_000) {
    return `${(duration / 1000).toFixed(2)}s`;
  }

  if (duration < 3_600_000) {
    return `${Math.floor(duration / 60_000)}min ${((duration % 60_000) / 1000).toFixed(2)}s`;
  }

  return `${Math.floor(duration / 3_600_000)}h ${Math.floor((duration % 3_600_000) / 60_000)}min`;
}
