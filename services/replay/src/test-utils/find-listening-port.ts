const LISTENING_PATTERN = /listening on port (?<port>\d+)/;

export function findListeningPort(line: string): number | undefined {
  const port = LISTENING_PATTERN.exec(line)?.groups?.['port'];

  return port === undefined ? undefined : Number(port);
}
