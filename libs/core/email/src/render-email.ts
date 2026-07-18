import type { SelectorDefinition } from 'html-to-text';
import { convert } from 'html-to-text';
import { renderToStaticMarkup } from 'react-dom/server';

const XHTML_DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

const PLAIN_TEXT_SELECTORS: ReadonlyArray<SelectorDefinition> = [
  { format: 'skip', selector: 'img' },
  { format: 'skip', selector: '[data-skip-in-text=true]' },
  { options: { hideLinkHrefIfSameAsText: true, linkBrackets: false }, selector: 'a' },
];

interface EmailConfig {
  component: React.ReactElement;
}

interface EmailData {
  html: string;
  plainText: string;
}

/**
 * Renders an email component to its deliverable html and plain-text forms through react-dom
 * directly — `@react-email/render` cannot run inside a `bun build --compile` binary (the bundler
 * initializes its module body before the react binding it closes over exists, so the first render
 * throws), and the compiled service binaries are exactly where this runs. The doctype and
 * plain-text selectors match what `@react-email/render` produces, so delivered emails read the
 * same either way.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- config wraps a React element tree (mutable props); no deep-readonly form
export function renderEmail(config: EmailConfig): EmailData {
  const markup = renderToStaticMarkup(config.component);

  return {
    html: `${XHTML_DOCTYPE}${markup}`,
    plainText: convert(markup, {
      selectors: [...PLAIN_TEXT_SELECTORS],
      wordwrap: false,
    }),
  };
}
