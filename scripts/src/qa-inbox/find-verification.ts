import type { EmailContent, Verification, VerificationKind, VerificationKindOption } from './types';

// the same code rule the e2e sign-up journey applies to the stub's captured sends
const OTP_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const OTP_CODE_IN_TEXT_PATTERN = /verification code:\s*(?<code>[A-Z0-9]{6})\b/i;
const TWO_FACTOR_CODE_IN_TEXT_PATTERN = /finish signing in[^:]*:\s*(?<code>\d{6})\b/i;

const KIND_ORDER: ReadonlyArray<VerificationKind> = [
  'welcome',
  'change-email',
  'reset-password',
  'two-factor',
];

interface FindOptions {
  readonly origin?: string;
}

export function findVerification(
  content: EmailContent,
  kind: VerificationKindOption,
  options: FindOptions = {},
): Verification | null {
  const kinds = kind === 'any' ? KIND_ORDER : [kind];
  const links = collectLinks(content, options.origin);

  for (const candidate of kinds) {
    const found = KIND_FINDERS[candidate](content, links);

    if (found !== null) {
      return { kind: candidate, ...found };
    }
  }

  return null;
}

interface Link {
  readonly href: string;
  readonly params: Readonly<Record<string, string>>;
  readonly pathname: string;
}

type KindFinder = (
  content: EmailContent,
  links: ReadonlyArray<Link>,
) => Omit<Verification, 'kind'> | null;

const KIND_FINDERS: Record<VerificationKind, KindFinder> = {
  'change-email': (content, links) =>
    findOTPVerification(content, links, 'change-email', 'verify your new email address'),
  'reset-password': (_content, links) => findResetVerification(links),
  'two-factor': (content) => findTwoFactorVerification(content),
  welcome: (content, links) => findOTPVerification(content, links, 'onboarding', 'welcome to vers'),
};

function findOTPVerification(
  content: EmailContent,
  links: ReadonlyArray<Link>,
  type: string,
  heading: string,
): Omit<Verification, 'kind'> | null {
  const link = links.find(
    (candidate) => candidate.pathname === '/verify-otp' && candidate.params['type'] === type,
  );

  const text = toSearchableText(content);

  if (link === undefined && !text.toLowerCase().includes(heading)) {
    return null;
  }

  const linkCode = link?.params['code'] ?? null;

  const code =
    linkCode !== null && OTP_CODE_PATTERN.test(linkCode)
      ? linkCode
      : (OTP_CODE_IN_TEXT_PATTERN.exec(text)?.groups?.['code'] ?? null);

  if (code === null) {
    return null;
  }

  return { code, url: link?.href ?? null };
}

function findResetVerification(links: ReadonlyArray<Link>): Omit<Verification, 'kind'> | null {
  const link = links.find(
    (candidate) =>
      candidate.pathname === '/reset-password' && candidate.params['token'] !== undefined,
  );

  return link === undefined ? null : { code: null, url: link.href };
}

function findTwoFactorVerification(content: EmailContent): Omit<Verification, 'kind'> | null {
  const code = TWO_FACTOR_CODE_IN_TEXT_PATTERN.exec(toSearchableText(content))?.groups?.['code'];

  return code === undefined ? null : { code, url: null };
}

const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s<>"']+/g;
const HREF_PATTERN = /href="(?<href>[^"]+)"/g;

function collectLinks(content: EmailContent, origin: string | undefined): Array<Link> {
  const candidates = [
    ...Array.from(content.text.matchAll(URL_IN_TEXT_PATTERN), (match) => match[0]),
    ...Array.from(content.html.matchAll(HREF_PATTERN), (match) => match.groups?.['href'] ?? ''),
  ];

  const links: Array<Link> = [];

  for (const candidate of candidates) {
    const parsed = URL.parse(decodeEntities(candidate).replace(/[.,)]+$/, ''));

    if (parsed !== null && (origin === undefined || parsed.origin === origin)) {
      links.push({
        href: parsed.href,
        params: Object.fromEntries(parsed.searchParams),
        pathname: parsed.pathname,
      });
    }
  }

  return links;
}

function toSearchableText(content: EmailContent): string {
  return content.text.trim() === ''
    ? decodeEntities(content.html.replaceAll(/<[^>]+>/g, ' ')).replaceAll(/\s+/g, ' ')
    : content.text;
}

const ENTITIES: ReadonlyMap<string, string> = new Map([
  ['&#8203;', ''],
  ['&#x27;', "'"],
  ['&amp;', '&'],
  ['&gt;', '>'],
  ['&lt;', '<'],
  ['&quot;', '"'],
]);

function decodeEntities(value: string): string {
  return value.replaceAll(/&[#\w]+;/g, (entity) => ENTITIES.get(entity) ?? entity);
}
