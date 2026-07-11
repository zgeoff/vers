import type { Middleware } from './middleware';

const ANSI = {
  bold: '[1m',
  cyan: '[36m',
  green: '[32m',
  red: '[31m',
  reset: '[0m',
  yellow: '[33m',
} as const;

type Palette = Readonly<Record<keyof typeof ANSI, string>>;

const PLAIN: Palette = {
  bold: '',
  cyan: '',
  green: '',
  red: '',
  reset: '',
  yellow: '',
};

/**
 * The one logger capability this middleware needs — satisfied structurally by the app's pino
 * instance without pulling pino's own types into this module's public signature.
 */
interface RequestLoggerSink {
  readonly info: (message: string) => void;
}

interface MakeRequestLoggerOptions {
  readonly colorize?: boolean;
}

/**
 * Builds the request-lifecycle logging middleware: one line as a request starts, one line with
 * its status and duration once it finishes. Colorized by method and status for readable console
 * output by default; pass `colorize: false` where the lines feed a structured sink, so shipped
 * logs carry no escape codes.
 */
export function makeRequestLogger(
  logger: RequestLoggerSink,
  options?: MakeRequestLoggerOptions,
): Middleware {
  const palette = options?.colorize === false ? PLAIN : ANSI;

  return async (request, next) => {
    const start = performance.now();
    const path = formatRequestPath(new URL(request.url));

    logger.info(`${palette.bold}[<---]${palette.reset} ${request.method} ${path} processing...`);

    const response = await next();

    const duration = performance.now() - start;
    const methodColor = request.method === 'GET' ? palette.green : palette.yellow;
    const methodStyled = `${palette.bold}${methodColor}${request.method}${palette.reset}`;
    const statusColor = pickStatusColor(response.status, palette);
    const statusStyled = `${statusColor}${response.status}${palette.reset}`;
    const statusLabel = pickStatusLabel(response.status);

    logger.info(
      `${palette.bold}[${statusLabel}]${palette.reset} ${methodStyled} ${path} ${statusStyled} (${formatDuration(duration)})`,
    );

    return response;
  };
}

function pickStatusColor(status: number, palette: Palette): string {
  if (status >= 200 && status < 300) {
    return palette.green;
  }

  if (status >= 400 && status < 500) {
    return palette.yellow;
  }

  if (status >= 500) {
    return palette.red;
  }

  return palette.cyan;
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
