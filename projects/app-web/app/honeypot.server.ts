import { Honeypot } from 'remix-utils/honeypot/server';

export const honeypot = new Honeypot({
  ...(process.env['HONEYPOT_SECRET'] !== undefined && {
    encryptionSeed: process.env['HONEYPOT_SECRET'],
  }),
  ...(process.env['NODE_ENV'] === 'test' && { validFromFieldName: null }),
});
