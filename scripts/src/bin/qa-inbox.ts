import { Command, Option } from 'commander';
import { collectMatchingEmails } from '../qa-inbox/collect-matching-emails';
import { formatEmailTable } from '../qa-inbox/format-email-table';
import { readReceivedEmail } from '../qa-inbox/read-received-email';
import { readReceivedEmails } from '../qa-inbox/read-received-emails';
import { readResendAPIKey } from '../qa-inbox/read-resend-api-key';
import type { VerificationKindOption } from '../qa-inbox/types';
import { waitForEmail } from '../qa-inbox/wait-for-email';

const APP_ORIGIN = 'https://versidle.com';
const DEFAULT_SINCE_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const program = new Command()
  .name('qa-inbox')
  .description('read verification codes and links from email Resend received for a QA address');

interface WaitCommandOptions {
  readonly json: boolean;
  readonly kind: VerificationKindOption;
  readonly timeout: number;
  readonly to: string;
}

program
  .command('wait')
  .description('poll for an email to an address and print its verification code or link')
  .requiredOption('--to <address>', 'recipient address on the receiving domain')
  .addOption(
    new Option('--kind <kind>', 'which template to read')
      .choices(['welcome', 'change-email', 'reset-password', 'two-factor', 'any'])
      .default('any'),
  )
  .option('--timeout <seconds>', 'seconds to keep polling', Number, DEFAULT_TIMEOUT_SECONDS)
  .option('--json', 'print the result as JSON', false)
  .action(async (options: WaitCommandOptions) => {
    const since = new Date(Date.now() - DEFAULT_SINCE_WINDOW_MS);

    const apiKey = await readResendAPIKey();

    try {
      const found = await waitForEmail({
        apiKey,
        kind: options.kind,
        origin: APP_ORIGIN,
        since,
        timeoutMS: options.timeout * 1000,
        to: options.to,
      });

      if (options.json) {
        console.log(JSON.stringify(found));

        return;
      }

      console.log(`kind: ${found.kind}`);
      console.log(`code: ${found.code ?? '-'}`);
      console.log(`url: ${found.url ?? '-'}`);
    } catch (error) {
      console.error(`qa-inbox: gave up after ${options.timeout}s — ${toMessage(error)}`);
      process.exit(1);
    }
  });

interface ListCommandOptions {
  readonly limit: number;
  readonly to?: string;
}

program
  .command('list')
  .description('print the most recent received emails, newest first')
  .option('--to <address>', 'keep only emails sent to this address')
  .option('--limit <n>', 'emails to print', Number, DEFAULT_LIST_LIMIT)
  .action(async (options: ListCommandOptions) => {
    const apiKey = await readResendAPIKey();

    const listed = await readReceivedEmails(apiKey, {
      limit: options.to === undefined ? Math.min(options.limit, MAX_LIST_LIMIT) : MAX_LIST_LIMIT,
    });

    const emails =
      options.to === undefined
        ? listed
        : collectMatchingEmails(listed, { since: new Date(0), to: options.to });

    console.log(formatEmailTable(emails.slice(0, options.limit)));
  });

interface ShowCommandOptions {
  readonly json: boolean;
}

program
  .command('show')
  .description('print one received email')
  .argument('<id>', 'received email id from list')
  .option('--json', 'print the email as JSON', false)
  .action(async (id: string, options: ShowCommandOptions) => {
    const apiKey = await readResendAPIKey();
    const email = await readReceivedEmail(apiKey, id);

    if (options.json) {
      console.log(JSON.stringify(email));

      return;
    }

    console.log(`subject: ${email.subject}`);
    console.log(`from: ${email.from}`);
    console.log(`to: ${email.to.join(', ')}`);
    console.log(`received: ${email.createdAt}`);
    console.log('');
    console.log(email.text);
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-inbox: ${toMessage(error)}`);
  process.exit(1);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
