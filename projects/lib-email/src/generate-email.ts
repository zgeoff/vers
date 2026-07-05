import { render } from '@react-email/components';

interface EmailConfig {
  component: React.ReactElement;
}

interface EmailData {
  html: string;
  plainText: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function generateEmail(config: EmailConfig): Promise<EmailData> {
  const [html, plainText] = await Promise.all([
    render(config.component),
    render(config.component, { plainText: true }),
  ]);

  return { html, plainText };
}
