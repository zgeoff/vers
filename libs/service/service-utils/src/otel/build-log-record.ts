import type { AnyValue, AnyValueMap, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { isRecord } from './is-record';

/**
 * Maps one parsed pino line onto the OpenTelemetry log data model: `msg` becomes the body, pino's
 * numeric `level` maps to the matching severity (lines without a recognised level report as INFO),
 * `time` becomes the timestamp, and every remaining key rides along as an attribute.
 */
export function buildLogRecord(line: Readonly<Record<string, unknown>>): LogRecord {
  const { level, msg, time, ...attributes } = line;
  const severity = pickSeverity(level);

  return {
    attributes: toAnyValueMap(attributes),
    ...(typeof msg === 'string' && { body: msg }),
    severityNumber: severity.number,
    severityText: severity.text,
    ...(typeof time === 'number' && { timestamp: time }),
  };
}

interface Severity {
  readonly number: SeverityNumber;
  readonly text: string;
}

const INFO_SEVERITY: Severity = { number: SeverityNumber.INFO, text: 'info' };

const PINO_LEVEL_SEVERITIES: ReadonlyMap<number, Severity> = new Map([
  [10, { number: SeverityNumber.TRACE, text: 'trace' }],
  [20, { number: SeverityNumber.DEBUG, text: 'debug' }],
  [30, INFO_SEVERITY],
  [40, { number: SeverityNumber.WARN, text: 'warn' }],
  [50, { number: SeverityNumber.ERROR, text: 'error' }],
  [60, { number: SeverityNumber.FATAL, text: 'fatal' }],
]);

function pickSeverity(level: unknown): Severity {
  return (
    (typeof level === 'number' ? PINO_LEVEL_SEVERITIES.get(level) : undefined) ?? INFO_SEVERITY
  );
}

function toAnyValueMap(record: Readonly<Record<string, unknown>>): AnyValueMap {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toAnyValue(value)]));
}

function toAnyValue(value: unknown): AnyValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toAnyValue(item));
  }

  if (isRecord(value)) {
    return toAnyValueMap(value);
  }

  return undefined;
}
