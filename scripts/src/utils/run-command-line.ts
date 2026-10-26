import {
  cli,
  isArgsValidationError,
  isCommandNotFoundError,
  isCommandResolutionError,
} from 'gunshi';
import type { CommandContext, SubCommandable } from 'gunshi';

interface CommandLineOutput {
  readonly error: (text: string) => void;
  readonly log: (text: string) => void;
}

interface CommandLineOptions {
  readonly output: CommandLineOutput;
  readonly subCommands?: Readonly<Record<string, SubCommandable>>;
}

export async function runCommandLine(
  argv: ReadonlyArray<string>,
  entry: SubCommandable,
  options: CommandLineOptions,
): Promise<boolean> {
  const name = entry.name ?? '';
  let isMissingCommand = false;

  const runnable: SubCommandable = entry.run
    ? entry
    : {
        ...entry,
        run: async (ctx: Readonly<CommandContext>) => {
          isMissingCommand = true;

          const usage = await renderCommandUsage(ctx);

          options.output.log(usage);
          options.output.error(`${name}: name a command`);
        },
      };

  try {
    const usage = await cli([...argv], runnable, {
      name,
      renderHeader: null,
      strict: true,
      subCommands: { ...options.subCommands },
      usageSilent: true,
    });

    if (usage !== undefined) {
      options.output.log(usage);
    }
  } catch (error) {
    if (!isRefusedCommandLine(error)) {
      throw error;
    }

    for (const reason of error.errors) {
      options.output.error(`${name}: ${toMessage(reason)}`);
    }

    return false;
  }

  return !isMissingCommand;
}

function renderCommandUsage(ctx: Readonly<CommandContext>): Promise<string> {
  return ctx.env.renderUsage?.(ctx) ?? Promise.resolve('');
}

// gunshi throws one AggregateError that holds every reason it refused the command line, so an
// error it holds of any other kind came from a command's own run.
function isRefusedCommandLine(error: unknown): error is AggregateError {
  return (
    error instanceof AggregateError &&
    error.errors.every(
      (reason) =>
        isArgsValidationError(reason) ||
        isCommandNotFoundError(reason) ||
        isCommandResolutionError(reason),
    )
  );
}

function toMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
