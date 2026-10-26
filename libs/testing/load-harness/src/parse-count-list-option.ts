import { parseIntegerOption } from '@vers/scripts';

export function parseCountListOption(value: string): Array<number> {
  return value.split(',').map((entry) => parseIntegerOption(entry.trim(), 1));
}
