# READMEs

A README reader wants three things, in order: the pitch, the install, and the capabilities with
their configuration. Everything else lives in a guide in `docs/`, in `--help`, or in the config
schema.

A package README (one for a published package, classified as the table below states) has six
sections, in this order:

1. Hero: the logo or title, badges, and at most 3 links.
2. Pitch: 1 to 2 short paragraphs and the demo, when one exists. The pitch names the 2 or 3 actions
   that get a first session working.
3. Install: one command and its prerequisites. Other install paths link to a guide.
4. Capabilities: one section per capability axis, such as "Supported agents" (one line per agent)
   and "Features" (a short list, one line and one link per feature).
5. Configuration: one paragraph and a link.
6. Documentation: one line linking `docs/`.

A plain repo README (a repo that publishes no package) has one paragraph, then Quick start, Checks,
Layout, and Documentation. A sub-package or folder README documents its own folder.

[`check-length.sh`](../scripts/check-length.sh) classifies each README outside `docs/` and
`.claude/`, and fails the run above its limit:

| README      | Classified by                                                | Target | Limit |
| ----------- | ------------------------------------------------------------ | ------ | ----- |
| Package     | a package.json beside it that is not private, or `--package` | 120    | 130   |
| Plain repo  | the root README of a repo that isn't a package               | 50     | 60    |
| Sub-package | any other README outside `docs/`                             | 60     | 70    |

A README never holds flags, exit codes, config keys, per-agent or per-platform install variants,
edge cases inside table rows, key or state tables, dated "checked" stamps, or person names. A
feature PR rewrites only a README sentence the feature made false. A PR that adds a README sentence
is a README PR, and the repo owner reviews it.
