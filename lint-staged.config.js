/* eslint-disable perfectionist/sort-objects */
export default {
  'projects/{app-web,service-api}/**/*.{ts,tsx}': () => [
    `bun run codegen:graphql`,
    'git add projects/app-web/app/gql schema.graphql',
  ],
  'projects/**/*.{ts,tsx}': () => [
    'bun run codegen:styles',
    'bun run typecheck',
    // changed-only: the full turbo test task drags in postgres-backed suites
    // that need the test container running
    'bunx vitest run --changed',
  ],
  // format/lint fixes land via lint-staged's own staging of task modifications
  'projects/**/*.{js,ts,jsx,tsx,json}': (files) => [
    `bun run format --files ${files.join(',')}`,
    `bun run lint --files ${files.join(',')}`,
  ],
  'projects/lib-postgres-schema/**/*.ts': () => [
    'bun run pg:migrations-generate',
    'git add projects/db-postgres/migrations',
  ],
  '**/*.graphql': () => ['bun run format'],
};
/* eslint-enable perfectionist/sort-objects */
