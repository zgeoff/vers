const LISTENING_PATTERN = /listening on port (?<port>\d+)/;

/**
 * Scans one line of a service process's stdout for the boot log's bound-port announcement — the
 * only place a `PORT=0` OS-assigned port is reported back.
 */
export function findListeningPort(line: string): number | undefined {
  const port = LISTENING_PATTERN.exec(line)?.groups?.['port'];

  return port === undefined ? undefined : Number(port);
}
