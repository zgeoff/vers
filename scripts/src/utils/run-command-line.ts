import {
  ArgsValidationError,
  cli,
  isArgsValidationError,
  isCommandNotFoundError,
  isCommandResolutionError,
  resolveArgs,
} from 'gunshi';
import type { ArgSchema, Args, CommandContext, SubCommandable } from 'gunshi';

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
  const hasSeparator = argv.includes('--');
  let isMissingCommand = false;

  const runnable: SubCommandable = entry.run
    ? withOperandArgs(entry, hasSeparator)
    : {
        ...entry,
        run: async (ctx: Readonly<CommandContext>) => {
          isMissingCommand = true;

          const usage = await renderCommandUsage(ctx);

          options.output.log(usage);
          options.output.error(`${name}: name a command`);
        },
      };

  const subCommands = Object.fromEntries(
    Object.entries(options.subCommands ?? {}).map(([key, command]) => [
      key,
      withOperandArgs(command, hasSeparator),
    ]),
  );

  try {
    const usage = await cli([...argv], runnable, {
      name,
      renderHeader: null,
      strict: true,
      subCommands,
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

// gunshi fills no positional argument from the words after `--`, reports one they would fill as
// missing before the command runs, and drops a word that no argument takes, so fixed positional
// arguments resolve again over every positional word.
function withOperandArgs(command: SubCommandable, hasSeparator: boolean): SubCommandable {
  const args: Args = command.args ?? {};
  const run: ((ctx: Readonly<CommandContext>) => unknown) | undefined = command.run;
  const positionals = Object.values(args).filter((schema) => schema.type === 'positional');

  if (run === undefined || positionals.some((schema) => schema.multiple === true)) {
    return command;
  }

  return {
    ...command,
    args: hasSeparator ? toOptionalPositionals(args) : args,
    run: (ctx: Readonly<CommandContext>) => {
      const resolved = resolveArgs(
        args,
        ctx.tokens.filter((token) => token.kind !== 'option-terminator'),
        { shortGrouping: true, skipPositional: ctx.commandPath.length - 1 },
      );

      const surplus = resolved.positionals.slice(ctx.commandPath.length + positionals.length);

      const reasons = [
        ...(resolved.error?.errors ?? []),
        ...(surplus.length > 0
          ? [new ArgsValidationError(`unexpected arguments: ${surplus.join(' ')}`)]
          : []),
      ];

      if (reasons.length > 0) {
        throw new AggregateError(reasons, reasons.map((reason) => toMessage(reason)).join('\n'));
      }

      return run({
        ...ctx,
        explicit: resolved.explicit,
        positionals: resolved.positionals,
        rest: resolved.rest,
        values: resolved.values,
      });
    },
  };
}

function toOptionalPositionals(args: Args): Args {
  return Object.fromEntries(
    Object.entries(args).map(([key, schema]): [string, ArgSchema] => [
      key,
      schema.type === 'positional' ? { ...schema, required: false } : schema,
    ]),
  );
}

function toMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
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
