import { SpamError } from 'remix-utils/honeypot/server';
import { honeypot } from '../honeypot.server';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function checkHoneypot(formData: FormData) {
  try {
    await honeypot.check(formData);
  } catch (error) {
    if (error instanceof SpamError) {
      throw new Response('Form not submitted properly', { status: 400 });
    }

    throw error;
  }
}
