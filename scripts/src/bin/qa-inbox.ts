import { define } from 'gunshi';
import { collectMatchingEmails } from '../qa-inbox/collect-matching-emails';
import { formatEmailTable } from '../qa-inbox/format-email-table';
import { MAX_LIST_LIMIT } from '../qa-inbox/max-list-limit';
import { QA_INBOX_ARGS } from '../qa-inbox/qa-inbox-args';
import { readReceivedEmail } from '../qa-inbox/read-received-email';
import { readReceivedEmails } from '../qa-inbox/read-received-emails';
import { readResendAPIKey } from '../qa-inbox/read-resend-api-key';
import { toPrintableText } from '../qa-inbox/to-printable-text';
import { waitForEmail } from '../qa-inbox/wait-for-email';
import { runCommandLine } from '../utils/run-command-line';

const APP_ORIGIN = 'https://versidle.com';
const DEFAULT_SINCE_WINDOW_MS = 2 * 60 * 1000;

const waitCommand = define({
  name: 'wait',
  description: 'poll for an email to an address and print its verification code or link',
  args: QA_INBOX_ARGS.wait,
  run: async (ctx) => {
    const options = ctx.values;

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
  },
});

const listCommand = define({
  name: 'list',
  description: 'print the most recent received emails, newest first',
  args: QA_INBOX_ARGS.list,
  run: async (ctx) => {
    const options = ctx.values;

    const apiKey = await readResendAPIKey();

    const listed = await readReceivedEmails(apiKey, {
      limit: options.to === undefined ? options.limit : MAX_LIST_LIMIT,
    });

    const emails =
      options.to === undefined
        ? listed
        : collectMatchingEmails(listed, { since: new Date(0), to: options.to });

    console.log(formatEmailTable(emails.slice(0, options.limit)));
  },
});

const showCommand = define({
  name: 'show',
  description: 'print one received email',
  args: QA_INBOX_ARGS.show,
  run: async (ctx) => {
    const options = ctx.values;

    const apiKey = await readResendAPIKey();
    const email = await readReceivedEmail(apiKey, options.id);

    if (options.json) {
      console.log(JSON.stringify(email));

      return;
    }

    console.log(`subject: ${toPrintableText(email.subject)}`);
    console.log(`from: ${toPrintableText(email.from)}`);
    console.log(`to: ${toPrintableText(email.to.join(', '))}`);
    console.log(`received: ${toPrintableText(email.createdAt)}`);
    console.log('');
    console.log(toPrintableText(email.text, { keepLineBreaks: true }));
  },
});

const entry = define({
  name: 'qa-inbox',
  description: 'read verification codes and links from email Resend received for a QA address',
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, {
    output: console,
    subCommands: { list: listCommand, show: showCommand, wait: waitCommand },
  });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`qa-inbox: ${toMessage(error)}`);
  process.exit(1);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
