export function buildProviderAppName(engineHash: string): string {
  return `vers-replay-${engineHash.slice(0, 12)}`;
}
