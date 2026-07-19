import { isDefinedError, safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import type { z } from 'zod';
import { requireAuth } from '../../lib/auth/require-auth';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';
import { logger } from '../../server/logger';
import { AvatarCreateFormSchema } from './avatar-create-form-schema';
import type { AvatarCreateResult } from './types';

/**
 * A taken name reports a field error instead of the service's generic conflict message.
 */
export async function runAvatarCreate(formData: FormData): Promise<AvatarCreateResult> {
  await requireAuth();

  const submission = AvatarCreateFormSchema.safeParse({
    mode: formData.get('mode') ?? undefined,
    name: formData.get('name'),
  });

  if (!submission.success) {
    return { fieldErrors: toFieldErrors(submission.error), status: 'invalid-fields' };
  }

  const [error] = await safe(
    avatarClient.createAvatar({ mode: submission.data.mode, name: submission.data.name }),
  );

  if (error) {
    // only the declared name conflict is normal flow; any other failure — transport, or a defined
    // error the conflict message would misreport — is logged
    if (!isDefinedError(error) || error.code !== 'CONFLICT') {
      logger.error({ err: error }, 'avatar creation failed');
    }

    return {
      fieldErrors: { name: 'An avatar with that name already exists' },
      status: 'invalid-fields',
    };
  }

  throw redirect({ href: '/explore' });
}

function toFieldErrors(error: z.ZodError): AvatarCreateResult['fieldErrors'] {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    if (typeof field === 'string' && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
