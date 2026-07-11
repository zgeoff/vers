import * as E from '@react-email/components';
import { generateEmail } from './generate-email';
import { ExistingAccountEmail } from './templates/existing-account-email';

interface Config {
  email: string;
}

export function generateExistingAccountEmail(config: Readonly<Config>) {
  return generateEmail({
    component: (
      <E.Html dir="ltr" lang="en">
        <ExistingAccountEmail email={config.email} />
      </E.Html>
    ),
  });
}
