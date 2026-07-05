import { type Submission } from '@conform-to/react';
import { Client } from '@urql/core';
import { z } from 'zod';
import type { VerifyOTPFormSchema } from './route';

export enum QueryParam {
  Code = 'code',
  RedirectTo = 'redirect',
  Target = 'target',
  Type = 'type',
}

export interface HandleVerificationContext {
  body: FormData | URLSearchParams;
  client: Client;
  request: Request;
  submission: Submission<
    z.input<typeof VerifyOTPFormSchema>,
    Array<string>,
    z.output<typeof VerifyOTPFormSchema>
  >;
  transactionToken: string;
}
