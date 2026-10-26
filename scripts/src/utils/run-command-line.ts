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
  const gunshiArgv = toGunshiArgv(argv, entry, options.subCommands ?? {});
  const hasSeparator = gunshiArgv.includes('--');
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
    const usage = await cli(gunshiArgv, runnable, {
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

const NEGATIVE_NUMBER = /^-\d*\.?\d+(?:e[+-]?\d+)?$/iu;

// gunshi reads every word that starts with `-` as a flag, where commander took a negative number as
// an argument and the word after a value flag as its value, so the flag joins its value and the
// arguments from the first negative number on move after `--`.
function toGunshiArgv(
  argv: ReadonlyArray<string>,
  entry: SubCommandable,
  subCommands: Readonly<Record<string, SubCommandable>>,
): Array<string> {
  const separator = argv.indexOf('--');
  const head = separator === -1 ? argv : argv.slice(0, separator);
  const tail = separator === -1 ? [] : argv.slice(separator + 1);
  const commands = [entry, ...Object.values(subCommands)];

  const routingArgs: Args = Object.fromEntries(
    commands
      .flatMap((command) => Object.entries(toArgs(command)))
      .filter(([_key, schema]) => schema.type !== 'positional'),
  );

  const headOperand = findFirstOperand(head, routingArgs);
  const tailCommand = headOperand === undefined ? pickCommandName(tail[0], subCommands) : undefined;
  const routedHead = tailCommand === undefined ? head : [...head, tailCommand];
  const routedTail = tailCommand === undefined ? tail : tail.slice(1);
  const commandName = pickCommandName(headOperand, subCommands) ?? tailCommand;
  const command = commandName === undefined ? entry : subCommands[commandName];
  const commandArgs = toArgs(command);
  const kept: Array<string> = [];
  const moved: Array<string> = [];
  let isCommandSeen = commandName === undefined;

  for (let index = 0; index < routedHead.length; index++) {
    const word = routedHead[index] ?? '';
    const next = routedHead[index + 1];
    const flagArgs = isCommandSeen ? commandArgs : routingArgs;

    if (isValueFlag(word, flagArgs) && next !== undefined) {
      kept.push(`${word}=${next}`);

      index++;
    } else if (!isCommandSeen && word === commandName) {
      isCommandSeen = true;

      kept.push(word);
    } else if (isFlagWord(word)) {
      kept.push(word);
    } else if (moved.length > 0 || NEGATIVE_NUMBER.test(word)) {
      moved.push(word);
    } else {
      kept.push(word);
    }
  }

  return moved.length === 0 && separator === -1 ? kept : [...kept, '--', ...moved, ...routedTail];
}

function toArgs(command: SubCommandable | undefined): Args {
  return command?.args ?? {};
}

function findFirstOperand(head: ReadonlyArray<string>, routingArgs: Args): string | undefined {
  for (let index = 0; index < head.length; index++) {
    const word = head[index] ?? '';

    if (isValueFlag(word, routingArgs)) {
      index++;
    } else if (word !== '' && !isFlagWord(word)) {
      return word;
    }
  }

  return undefined;
}

function isValueFlag(word: string, args: Args): boolean {
  const schema = word.startsWith('--') && !word.includes('=') ? args[word.slice(2)] : undefined;

  return schema !== undefined && schema.type !== 'boolean' && schema.type !== 'positional';
}

function isFlagWord(word: string): boolean {
  return word.length > 1 && word.startsWith('-') && !NEGATIVE_NUMBER.test(word);
}

function pickCommandName(
  word: string | undefined,
  subCommands: Readonly<Record<string, SubCommandable>>,
): string | undefined {
  return word !== undefined && Object.hasOwn(subCommands, word) ? word : undefined;
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
      const words = [...ctx.positionals, ...ctx.rest];
      const operandStart = getOperandStart(words, ctx.commandPath);

      const resolved = resolveArgs(
        args,
        ctx.tokens.filter((token) => token.kind !== 'option-terminator'),
        { shortGrouping: true, skipPositional: operandStart - 1 },
      );

      const surplus = resolved.positionals.slice(operandStart + positionals.length);
      const parseReasons: ReadonlyArray<unknown> = resolved.error?.errors ?? [];

      const reasons = [
        ...parseReasons,
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

// gunshi skips an empty word while it routes to a command, but the word stays a positional.
function getOperandStart(
  positionals: ReadonlyArray<string>,
  commandPath: ReadonlyArray<string>,
): number {
  return commandPath.reduce((start, name) => positionals.indexOf(name, start) + 1, 0);
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
