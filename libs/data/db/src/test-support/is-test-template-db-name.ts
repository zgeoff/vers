import { TEST_TEMPLATE_DB_PREFIX } from './test-template-db-prefix';

export function isTestTemplateDBName(name: string): boolean {
  return name.startsWith(TEST_TEMPLATE_DB_PREFIX);
}
