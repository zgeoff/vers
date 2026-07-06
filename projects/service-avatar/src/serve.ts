import { avatarContract } from '@vers/contract-avatar';
import { createDB } from '@vers/db';
import { createService } from '@vers/service-runtime';
import * as z from 'zod';
import { buildAvatarRouter } from './build-router';

const service = await createService({
  buildRouter: (runtime) =>
    buildAvatarRouter({ db: createDB({ databaseURL: runtime.env.DATABASE_URL }) }),
  contract: avatarContract,
  envShape: { DATABASE_URL: z.string() },
  name: 'service-avatar',
});

service.listen();
