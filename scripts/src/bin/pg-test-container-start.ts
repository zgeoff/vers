import {
  buildTestTemplateDBName,
  createTestTemplate,
  readCurrentBranch,
} from '@vers/db/test-support';
import { createPostgresContainer, getContainerConnectionURI } from '@vers/service-test-utils';

const container = await createPostgresContainer();

const templateDB = process.env['TEST_TEMPLATE_DB'] ?? buildTestTemplateDBName(readCurrentBranch());

await createTestTemplate({ baseURI: getContainerConnectionURI(container), templateDB });

console.log(`⚡ postgres test container started (template: ${templateDB})`);

// testcontainers' reaper socket stays open by design, and bun does not unref
// it the way node does — without an explicit exit the process hangs forever
process.exit(0);
