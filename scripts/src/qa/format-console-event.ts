import { z } from 'zod';
import type { CDPEvent } from './types';

const CONSOLE_LIMIT = 500;
const EXCEPTION_LIMIT = 800;
const LOG_LIMIT = 500;

const remoteObjectSchema = z.object({
  description: z.string().optional(),
  type: z.string(),
  unserializableValue: z.string().optional(),
  value: z.unknown().optional(),
});

const consoleCallSchema = z.object({
  args: z.array(remoteObjectSchema),
  type: z.string(),
});

const exceptionSchema = z.object({
  exceptionDetails: z.object({
    exception: remoteObjectSchema.optional(),
    text: z.string(),
  }),
});

const logEntrySchema = z.object({
  entry: z.object({
    level: z.string(),
    text: z.string(),
    url: z.string().optional(),
  }),
});

export function formatConsoleEvent(event: CDPEvent): string | null {
  switch (event.method) {
    case 'Runtime.consoleAPICalled': {
      const call = consoleCallSchema.parse(event.params);

      return `console.${call.type}: ${call.args.map(formatRemoteObject).join(' ')}`.slice(
        0,
        CONSOLE_LIMIT,
      );
    }
    case 'Runtime.exceptionThrown': {
      const details = exceptionSchema.parse(event.params).exceptionDetails;

      const thrown =
        details.exception === undefined ? details.text : formatRemoteObject(details.exception);

      return `exception: ${thrown}`.slice(0, EXCEPTION_LIMIT);
    }
    case 'Log.entryAdded': {
      const entry = logEntrySchema.parse(event.params).entry;
      const source = entry.url === undefined ? '' : ` ${entry.url}`;

      return `log/${entry.level}: ${entry.text}${source}`.slice(0, LOG_LIMIT);
    }
    default: {
      return null;
    }
  }
}

function formatRemoteObject(object: z.infer<typeof remoteObjectSchema>): string {
  if (object.value !== undefined) {
    return typeof object.value === 'string' ? object.value : JSON.stringify(object.value);
  }

  return object.unserializableValue ?? object.description ?? `[${object.type}]`;
}
