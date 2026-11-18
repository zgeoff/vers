# Edit the skill

- Give each feature a file, `references/feature-<name>.md`, with two sections:
  - `## Journey`, whose first `bash` block starts with `bun verify use --feature <name>`;
  - `## End state`, the state of the app that shows the feature works.
- Edit only these parts of `SKILL.md`. An upgrade of the template replaces every line of `SKILL.md`
  outside them.
  - the frontmatter's `name` and `description`, and the `#` title;
  - the lines between `<!-- repo: <block> -->` and the next `<!-- /repo -->`;
  - the table between the `wringer:features` markers: replace it with the output of
    `bun verify features --markdown`, after you change the registry.
- Leave `references/exit-codes.md` and this file unchanged. The template ships them, and an upgrade
  replaces them.
- Leave `metadata.wringer-template` in the `SKILL.md` frontmatter as it is. `bun verify lint`
  compares it with the hash of the installed template. When `lint` fails with check `template`, run
  `bun verify guide maintain`, and follow its steps to upgrade the template.
