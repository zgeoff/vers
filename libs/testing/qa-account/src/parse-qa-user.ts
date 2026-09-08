import { AvatarNameSchema } from '@vers/contract-avatar';
import { USERNAME_MAX_LENGTH, UsernameSchema } from '@vers/contract-user';
import * as z from 'zod';
import type { QAUser } from './types';

export const QA_DOMAIN = 'qa.versidle.com';
const NAME_PATTERN = /^[a-z0-9][a-z0-9._+-]{0,63}$/;
const AVATAR_NAME_MAX_LENGTH = 16;
const DIGIT_LETTERS = 'abcdefghij';

export function parseQAUser(raw: string): QAUser {
  const normalized = raw.trim().toLowerCase();
  const at = normalized.indexOf('@');
  const name = at === -1 ? normalized : normalized.slice(0, at);
  const domain = at === -1 ? QA_DOMAIN : normalized.slice(at + 1);

  if (domain !== QA_DOMAIN) {
    throw new Error(`refusing "${raw}": only addresses under ${QA_DOMAIN} are QA accounts`);
  }

  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `invalid QA account name "${name}": use letters, digits, ".", "_", "+" or "-", starting with a letter or digit`,
    );
  }

  return {
    avatarName: parseIdentity('avatar name', AvatarNameSchema, buildAvatarName(name)),
    email: `${name}@${QA_DOMAIN}`,
    name,
    username: parseIdentity('username', UsernameSchema, buildUsername(name)),
  };
}

function buildUsername(name: string): string {
  return name.replaceAll(/[^a-z0-9_]/g, '_').slice(0, USERNAME_MAX_LENGTH);
}

// the avatar name contract admits letters only, so each digit maps to a letter and every other
// character drops
function buildAvatarName(name: string): string {
  return name
    .replaceAll(/[0-9]/g, (digit) => DIGIT_LETTERS.charAt(Number(digit)))
    .replaceAll(/[^a-z]/g, '')
    .slice(0, AVATAR_NAME_MAX_LENGTH);
}

function parseIdentity(label: string, schema: z.ZodType<string>, candidate: string): string {
  const parsed = schema.safeParse(candidate);

  if (!parsed.success) {
    throw new Error(
      `the QA account name yields no valid ${label} ("${candidate}"): ${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}
