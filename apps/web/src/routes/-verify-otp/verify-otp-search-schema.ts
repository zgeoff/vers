import * as z from 'zod';

export const VerifyOTPSearchSchema = z.object({
  code: z.string().optional(),
  redirect: z.string().optional(),
  target: z.string().optional(),
  type: z.string().optional(),
});

export type VerifyOTPSearch = z.infer<typeof VerifyOTPSearchSchema>;
