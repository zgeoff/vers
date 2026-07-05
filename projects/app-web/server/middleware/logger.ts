import type { Context, Next } from 'hono';
import { logger as appLogger } from '../logger';

enum Token {
  Bold = '\u001B[1m',
  Cyan = '\u001B[36m',
  Green = '\u001B[32m',
  Magenta = '\u001B[35m',
  Red = '\u001B[31m',
  Reset = '\u001B[0m',
  Yellow = '\u001B[33m',
}

export async function logger(ctx: Context, next: Next): Promise<void> {
  const start = performance.now();
  const { method } = ctx.req;
  const url = getURL(new URL(ctx.req.url));

  appLogger.info(`${Token.Bold}[<---]${Token.Reset} ${method} ${url} processing...`);

  await next();

  const duration = performance.now() - start;
  const { status } = ctx.res;

  const methodStyled = `${Token.Bold}${method === 'GET' ? Token.Green : Token.Yellow}${method}${Token.Reset}`;
  const statusColor = getStatusColor(status);
  const statusStyled = `${statusColor}${status}${Token.Reset}`;
  const statusLabel = getStatusLabel(status);
  const formattedDuration = formatDuration(duration);

  appLogger.info(
    `${Token.Bold}[${statusLabel}]${Token.Reset} ${methodStyled} ${url} ${statusStyled} (${formattedDuration})`,
  );
}

function getStatusColor(status: number) {
  if (status >= 200 && status < 300) {
    return Token.Green;
  }

  if (status >= 400 && status < 500) {
    return Token.Yellow;
  }

  if (status >= 500) {
    return Token.Red;
  }

  return Token.Cyan;
}

function getStatusLabel(status: number) {
  if (status >= 200 && status < 300) {
    return '--->';
  }

  if (status >= 400 && status < 500) {
    return `CLIENT ERROR`;
  }

  if (status >= 500) {
    return `SERVER ERROR`;
  }

  return `OTHER`;
}

function getURL(url: URL) {
  if (url.pathname === '/__manifest') {
    return url.pathname;
  }

  return url.pathname + url.search;
}

function formatDuration(duration: number) {
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
