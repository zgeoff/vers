import { TEST_TEMPLATE_DB_PREFIX } from './test-template-db-prefix';

/**
 * Whether `name` is one of the branch-scoped test-template databases this
 * package provisions, as opposed to the shared container's own bootstrap
 * `test_template` database or an unrelated database.
 */
export function isTestTemplateDBName(name: string): boolean {
  return name.startsWith(TEST_TEMPLATE_DB_PREFIX);
}
