# READMEs

A README reader wants three things, in order: the pitch, the install, and the capabilities with
their configuration. Everything else lives in a guide in `docs/`, in `--help`, or in the config
schema.

Every root README opens with this header, whether the repo publishes a package or not:

```text
<div align="center">
  <h1>name</h1>

  <p>
    <a href="https://www.npmjs.com/package/@scope/name"><img src="https://img.shields.io/npm/v/@scope/name" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a> •
    <a href="./docs/guides/first-guide.md">First guide</a> •
    <a href="./docs/guides/second-guide.md">Second guide</a>
  </p>
</div>

One-line description of the repo.
```

The `<h1>` holds the repo name, or the repo's logo as an `<img>` whose alt text is the name. The
badges `<p>` holds one badge link per line, and the links `<p>` holds at most 3 links joined by `•`.
The one-line description sits below the div, as plain Markdown. A repo with no badge or no link
drops that `<p>`.

A package README (the root README of a repo that publishes a package, or a README under `packages/`)
has six sections, in this order:

1. Hero: the header above.
2. Pitch: 1 to 2 short paragraphs and the demo, when one exists. The pitch names the 2 or 3 actions
   that get a first session working.
3. Install: one command and its prerequisites. Other install paths link to a guide.
4. Capabilities: one section per capability axis, such as "Supported agents" (one line per agent)
   and "Features" (a short list, one line and one link per feature).
5. Configuration: one paragraph and a link.
6. Documentation: one line linking `docs/`.

A plain repo README (a repo that publishes no package) opens with the header, then has one
paragraph, Quick start, Checks, Layout, and Documentation.

## The five kinds of README

`check-readmes.sh` accepts five kinds of README, and fails on any other:

1. the root `README.md`;
2. a README in a folder that holds a `package.json`, `go.mod` or `Cargo.toml`;
3. `docs/README.md`;
4. a design README: `docs/design/<work>/README.md`, or the README of a folder inside a design folder
   whose own README is a design README, outside any `spikes/` folder;
5. a spike README, whose first H1 starts `Spike: `, or, outside `docs/design/`, the README of a
   folder whose direct subfolders hold a spike README.

Move the content of any other README into `docs/`, or into a code comment beside the code it
explains. A README that git marks `linguist-vendored` belongs to someone else, and the check skips
it.

## README limits

`chex length` takes each README's limit from its path alone, so the pre-push hook, CI and a repo's
own script give the same result. It checks each README outside `docs/` and `.claude/`, and each
spike README under `docs/design/**/spikes/*/`, and fails the run above its limit:

| README     | Path                                      | Target | Limit |
| ---------- | ----------------------------------------- | ------ | ----- |
| Front page | the root `README.md`                      | 80     | 100   |
| Package    | `packages/*/README.md`                    | 80     | 100   |
| Folder     | any other README, a spike README included | 60     | 70    |

A published package outside `packages/` takes the folder limit. The `--package` flag is deprecated:
the script prints a notice and ignores it.

A README never holds flags, exit codes, config keys, per-agent or per-platform install variants,
edge cases inside table rows, key or state tables, dated "checked" stamps, or person names. A
feature PR rewrites only a README sentence the feature made false. A PR that adds a README sentence
is a README PR, and the repo owner reviews it.
