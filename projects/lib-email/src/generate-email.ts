import { render } from '@react-email/components';

interface EmailConfig {
  readonly component: React.ReactElement;
}

interface EmailData {
  html: string;
  plainText: string;
}

export async function generateEmail(config: EmailConfig): Promise<EmailData> {
  const [html, plainText] = await Promise.all([
    render(config.component),
    render(config.component, { plainText: true }),
  ]);

  return { html, plainText };
}
