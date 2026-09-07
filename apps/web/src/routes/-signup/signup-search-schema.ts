import * as z from 'zod';

export const SignupReasonSchema = z.enum(['verification-lapsed']);

export type SignupReason = z.infer<typeof SignupReasonSchema>;

export const SignupSearchSchema = z.object({
  reason: z
    .unknown()
    .transform((value) => SignupReasonSchema.safeParse(value).data)
    .optional(),
});

export type SignupSearch = z.infer<typeof SignupSearchSchema>;
