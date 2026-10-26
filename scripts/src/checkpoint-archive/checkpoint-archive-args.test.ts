import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { CHECKPOINT_ARCHIVE_ARGS } from './checkpoint-archive-args';

test('#sweep reports without writing by default', () => {
  const resolved = resolveArgs(CHECKPOINT_ARCHIVE_ARGS.sweep, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ apply: false });
});

test('#sweep reads the apply flag', () => {
  const resolved = resolveArgs(CHECKPOINT_ARCHIVE_ARGS.sweep, parseArgs(['--apply']));

  expect({ ...resolved.values }).toStrictEqual({ apply: true });
});

test('#restore reads the activity id', () => {
  const resolved = resolveArgs(
    CHECKPOINT_ARCHIVE_ARGS.restore,
    parseArgs(['--activity', 'activity-1']),
  );

  expect({ ...resolved.values }).toStrictEqual({ activity: 'activity-1' });
});

test('#restore requires the activity id', () => {
  const resolved = resolveArgs(CHECKPOINT_ARCHIVE_ARGS.restore, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});
