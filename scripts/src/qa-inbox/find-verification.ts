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

export function findVerification(
  content: EmailContent,
  kind: VerificationKindOption,
): Verification | null {
  const kinds = kind === 'any' ? KIND_ORDER : [kind];

  for (const candidate of kinds) {
    const found = KIND_FINDERS[candidate](content);

    if (found !== null) {
      return { kind: candidate, ...found };
    }
  }

  return null;
}

type KindFinder = (content: EmailContent) => Omit<Verification, 'kind'> | null;

const KIND_FINDERS: Record<VerificationKind, KindFinder> = {
  'change-email': (content) =>
    findOTPVerification(content, 'change-email', 'verify your new email address'),
  'reset-password': (content) => findResetVerification(content),
  'two-factor': (content) => findTwoFactorVerification(content),
  welcome: (content) => findOTPVerification(content, 'onboarding', 'welcome to vers'),
};

function findOTPVerification(
  content: EmailContent,
  type: string,
  heading: string,
): Omit<Verification, 'kind'> | null {
  const url = collectURLs(content).find(
    (candidate) =>
      candidate.pathname === '/verify-otp' && candidate.searchParams.get('type') === type,
  );

  const text = toSearchableText(content);

  if (url === undefined && !text.toLowerCase().includes(heading)) {
    return null;
  }

  const urlCode = url?.searchParams.get('code') ?? null;

  const code =
    urlCode !== null && OTP_CODE_PATTERN.test(urlCode)
      ? urlCode
      : (OTP_CODE_IN_TEXT_PATTERN.exec(text)?.groups?.['code'] ?? null);

  if (code === null) {
    return null;
  }

  return { code, url: url?.href ?? null };
}

function findResetVerification(content: EmailContent): Omit<Verification, 'kind'> | null {
  const url = collectURLs(content).find(
    (candidate) => candidate.pathname === '/reset-password' && candidate.searchParams.has('token'),
  );

  return url === undefined ? null : { code: null, url: url.href };
}

function findTwoFactorVerification(content: EmailContent): Omit<Verification, 'kind'> | null {
  const code = TWO_FACTOR_CODE_IN_TEXT_PATTERN.exec(toSearchableText(content))?.groups?.['code'];

  return code === undefined ? null : { code, url: null };
}

const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s<>"']+/g;
const HREF_PATTERN = /href="(?<href>[^"]+)"/g;

function collectURLs(content: EmailContent): Array<URL> {
  const candidates = [
    ...Array.from(content.text.matchAll(URL_IN_TEXT_PATTERN), (match) => match[0]),
    ...Array.from(content.html.matchAll(HREF_PATTERN), (match) => match.groups?.['href'] ?? ''),
  ];

  const urls: Array<URL> = [];

  for (const candidate of candidates) {
    const parsed = URL.parse(decodeEntities(candidate).replace(/[.,)]+$/, ''));

    if (parsed !== null) {
      urls.push(parsed);
    }
  }

  return urls;
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
