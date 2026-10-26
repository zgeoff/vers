import type { TextFormatter } from '@logtape/logtape';
import { getJsonLinesFormatter } from '@logtape/logtape';
import { getPrettyFormatter } from '@logtape/pretty';

export function pickLogFormatter(format: 'json' | 'pretty'): TextFormatter {
  return format === 'pretty'
    ? getPrettyFormatter({ properties: true })
    : getJsonLinesFormatter({ properties: 'flatten' });
}
