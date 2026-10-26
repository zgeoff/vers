import { parseCountOption } from './parse-count-option';

export function parseCountListOption(value: string): Array<number> {
  return value.split(',').map((entry) => parseCountOption(entry.trim()));
}
