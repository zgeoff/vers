import * as ReactEmail from '@react-email/components';
import { renderEmail } from './render-email';
import { ExistingAccountEmail } from './templates/existing-account-email';

interface Config {
  email: string;
}

export function renderExistingAccountEmail(config: Readonly<Config>) {
  return renderEmail({
    component: (
      <ReactEmail.Html dir="ltr" lang="en">
        <ExistingAccountEmail email={config.email} />
      </ReactEmail.Html>
    ),
  });
}
