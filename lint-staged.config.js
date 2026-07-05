function quote(files) {
  return files.map((file) => `"${file}"`).join(' ');
}

const config = {
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

  // format/lint fixes land via lint-staged's own staging of task
  // modifications; the codemod runs before oxfmt so the formatter owns the
  // final state — it strips the codemod's import padding, which its own
  // import sorter contradicts
  'projects/**/*.{js,ts,jsx,tsx,json}': (files) => {
    const tsFiles = files.filter((file) => /\.tsx?$/.test(file));

    return [
      ...(tsFiles.length > 0 ? [`format-codemod --quiet ${quote(tsFiles)}`] : []),
      `oxfmt ${quote(files)}`,
      `oxlint --fix ${quote(files)}`,
    ];
  },

  'projects/lib-postgres-schema/**/*.ts': () => [
    'bun run pg:migrations-generate',
    'git add projects/db-postgres/migrations',
  ],

  '**/*.graphql': () => ['bun run format'],
};

export default config;
