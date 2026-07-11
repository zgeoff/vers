export function createLogLabel(value: string, id: string) {
  return `[${value}:${id.slice(0, 6)}]`;
}
