import * as z from 'zod';

export const LoginSearchSchema = z.object({ redirect: z.string().optional() });

export type LoginSearch = z.infer<typeof LoginSearchSchema>;
