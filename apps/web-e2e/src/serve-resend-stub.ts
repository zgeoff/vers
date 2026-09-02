import { z } from 'zod';

interface CapturedEmail {
  readonly html: string;
  readonly id: string;
  readonly subject: string;
  readonly text: string;
  readonly to: ReadonlyArray<string>;
}

const ToSchema = z.union([z.string(), z.array(z.string())]);

// `from`, `subject`, and `to` are required exactly as the real Resend endpoint requires them, so
// a payload production would reject can't quietly pass this gate
const SendPayloadSchema = z.object({
  from: z.string().min(1),
  html: z.string().optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  to: ToSchema,
});

const emails: Array<CapturedEmail> = [];
let nextID = 1;
const port = Number(process.env['RESEND_STUB_PORT'] ?? 3020);

// A capture-only stand-in for the Resend HTTP API: `POST /emails` accepts a send exactly like the
// endpoint resend-node targets via `RESEND_BASE_URL` and records it in memory; `GET /emails?to=`
// reads the captured sends back. State lives for the process lifetime.
Bun.serve({
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (url.pathname === '/emails' && request.method === 'POST') {
      const raw: unknown = await request.json();

      const body = SendPayloadSchema.parse(raw);

      const email: CapturedEmail = {
        html: body.html ?? '',
        id: `stub-${nextID++}`,
        subject: body.subject,
        text: body.text ?? '',
        to: Array.isArray(body.to) ? body.to : [body.to],
      };

      emails.push(email);

      return Response.json({ id: email.id });
    }

    if (url.pathname === '/emails' && request.method === 'GET') {
      const to = url.searchParams.get('to');
      const matches = to === null ? emails : emails.filter((email) => email.to.includes(to));

      return Response.json({ emails: matches });
    }

    return new Response(null, { status: 404 });
  },
  hostname: '0.0.0.0',
  port,
});

console.log(`resend stub listening on http://localhost:${port}`);
