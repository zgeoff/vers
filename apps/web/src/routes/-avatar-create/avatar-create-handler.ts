import { safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import type { z } from 'zod';
import { requireAuth } from '../../lib/auth/require-auth';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';
import { AvatarCreateFormSchema } from './avatar-create-form-schema';
import type { AvatarCreateResult } from './types';

/**
 * A taken name reports a field error instead of the service's generic conflict message.
 */
export async function avatarCreateHandler(formData: FormData): Promise<AvatarCreateResult> {
  await requireAuth();

  const submission = AvatarCreateFormSchema.safeParse({
    name: formData.get('name'),
  });

  if (!submission.success) {
    return { fieldErrors: toFieldErrors(submission.error), status: 'invalid-fields' };
  }

  const [error] = await safe(avatarClient.createAvatar({ name: submission.data.name }));

  if (error) {
    return {
      fieldErrors: { name: 'An avatar with that name already exists' },
      status: 'invalid-fields',
    };
  }

  throw redirect({ href: '/avatar' });
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
