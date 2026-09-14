import * as z from 'zod';

// one public JSON Web Key per signing key the service publishes; jose reads the set as-is, so the
// members beyond the four every key carries stay open, string-valued, and untouched
export const SigningKeySchema = z
  .object({
    alg: z.string(),
    kid: z.string(),
    kty: z.string(),
    use: z.literal('sig'),
  })
  .catchall(z.string())
  .readonly();

export const SigningKeySetSchema = z
  .object({
    keys: z.array(SigningKeySchema).readonly(),
  })
  .readonly();

export type SigningKey = z.infer<typeof SigningKeySchema>;

export type SigningKeySet = z.infer<typeof SigningKeySetSchema>;
