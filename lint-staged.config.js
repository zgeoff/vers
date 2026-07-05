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
  // modifications; oxfmt runs first, then the codemod owns the final state —
  // its blank-line padding is stable under the formatter's import sorting
  'projects/**/*.{js,ts,jsx,tsx,json}': (files) => {
    // the design-reference export is served verbatim and sits on both tools'
    // ignore lists; oxlint exits non-zero when every file it's given is ignored
    const ownFiles = files.filter((file) => !file.includes('app-design-reference/public/'));

    if (ownFiles.length === 0) {
      return [];
    }

    const tsFiles = ownFiles.filter((file) => /\.tsx?$/.test(file));

    // oxlint ignores all json (it only formats via oxfmt) and exits non-zero
    // when every file it's given is ignored
    const lintFiles = ownFiles.filter((file) => !file.endsWith('.json'));

    return [
      `oxfmt ${quote(ownFiles)}`,
      ...(tsFiles.length > 0 ? [`format-codemod --quiet ${quote(tsFiles)}`] : []),
      ...(lintFiles.length > 0 ? [`oxlint --fix ${quote(lintFiles)}`] : []),
    ];
  },

  'projects/lib-postgres-schema/**/*.ts': () => [
    'bun run pg:migrations-generate',
    'git add projects/db-postgres/migrations',
  ],

  '**/*.graphql': () => ['bun run format'],
};

export default config;
