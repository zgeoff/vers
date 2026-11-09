import { AvatarNameSchema } from '@vers/contract-avatar';
import { USERNAME_MAX_LENGTH, UsernameSchema } from '@vers/contract-user';
import * as z from 'zod';
import type { QAUserParse } from './types';

export const QA_DOMAIN = 'qa.versidle.com';
const NAME_PATTERN = /^[a-z0-9][a-z0-9._+-]{0,63}$/u;

export function parseQAUser(raw: string): QAUserParse {
  const normalized = raw.trim().toLowerCase();
  const at = normalized.indexOf('@');
  const name = at === -1 ? normalized : normalized.slice(0, at);
  const domain = at === -1 ? QA_DOMAIN : normalized.slice(at + 1);

  if (domain !== QA_DOMAIN) {
    return {
      kind: 'refused',
      reason: `refusing "${raw}": only addresses under ${QA_DOMAIN} are QA accounts`,
    };
  }

  if (!NAME_PATTERN.test(name)) {
    return {
      kind: 'refused',
      reason: `invalid QA account name "${name}": use letters, digits, ".", "_", "+" or "-", starting with a letter or digit`,
    };
  }

  const avatarName = parseIdentity('avatar name', AvatarNameSchema, buildAvatarName(name));

  if (avatarName.kind === 'refused') {
    return avatarName;
  }

  const username = parseIdentity('username', UsernameSchema, buildUsername(name));

  if (username.kind === 'refused') {
    return username;
  }

  return {
    kind: 'parsed',
    user: {
      avatarName: avatarName.value,
      email: `${name}@${QA_DOMAIN}`,
      name,
      username: username.value,
    },
  };
}

type IdentityParse =
  | { readonly kind: 'parsed'; readonly value: string }
  | { readonly kind: 'refused'; readonly reason: string };

function parseIdentity(label: string, schema: z.ZodType<string>, candidate: string): IdentityParse {
  const parsed = schema.safeParse(candidate);

  if (!parsed.success) {
    return {
      kind: 'refused',
      reason: `the QA account name yields no valid ${label} ("${candidate}"): ${z.prettifyError(parsed.error)}`,
    };
  }

  return { kind: 'parsed', value: parsed.data };
}

const AVATAR_NAME_MAX_LENGTH = 16;
const DIGIT_LETTERS = 'abcdefghij';

// the avatar name contract admits letters only, so each digit maps to a letter and every other
// character drops
function buildAvatarName(name: string): string {
  return name
    .replaceAll(/[0-9]/gu, (digit) => DIGIT_LETTERS.charAt(Number(digit)))
    .replaceAll(/[^a-z]/gu, '')
    .slice(0, AVATAR_NAME_MAX_LENGTH);
}

function buildUsername(name: string): string {
  return name.replaceAll(/[^a-z0-9_]/gu, '_').slice(0, USERNAME_MAX_LENGTH);
}
