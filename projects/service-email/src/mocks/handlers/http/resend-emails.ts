import { HttpResponse, http } from 'msw';

export const ENDPOINT_URL = `https://api.resend.com/emails`;

export const resendEmails = http.post(ENDPOINT_URL, () =>
  HttpResponse.json({ data: {}, success: true }),
);
