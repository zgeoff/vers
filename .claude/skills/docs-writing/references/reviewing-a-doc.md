# Reviewing a doc

Before you commit, review each file you touched in four passes. A review subagent runs the same four
passes with this guide as its only reference.

1. What it says. List the points each section makes and judge each one against "Deciding what to
   include". Check every fact against the doc that owns it, and each doc against
   [The docs/ tree](./docs-tree.md) and [READMEs](./readmes.md). For an architecture doc, also run
   the model test: read only its first sentences and its diagrams, and check that they give a
   correct rough model; then pick a case the doc never names and check that the doc lets you predict
   what the system does.
2. How it says it. Reread each surviving paragraph against "Writing the sentences", "Choosing
   words", "Shaping the doc", and "Formatting and links", in that order.
3. The scripted checks. Run from the repo root; the repo's `check:docs` script names the checks it
   takes, and CI runs the same ones:

   ```bash
   bun x @zgeoff/chex prose length links skill
   ```

   `chex prose` reads the READMEs, each spike's `results.md`, the Markdown under `docs/`, and each
   skill's Markdown. `chex length` prints each README against the limit its path sets and each docs/
   file over its cap, fails on a README over its limit, and its last line counts the READMEs and
   those over their limit. `chex vision` fails on a missing or over-long `docs/vision.md`, in a repo
   whose `check:docs` names it. `chex links` checks every relative link and anchor in the READMEs,
   the `results.md` files, `docs/`, and the skills, and fails on a broken one. It skips the
   docs-writing, project-docs-writing, and skill-writing skills, whose examples link to placeholder
   targets. Pass paths to check other Markdown. `chex skill` checks each skill's frontmatter and
   word limit, as the skill-writing skill describes, and passes in a repo with no skills. `prose`,
   `links` and `skill` skip a file git marks `linguist-vendored`. To check other prose, such as
   AGENTS.md, run `bun x @zgeoff/chex prose <path>...` on it.

   `chex prose` fails on traces of the work session, the banned words a grep can catch, values with
   units under `docs/architecture/`, formatting faults, untagged code blocks, and a paragraph over
   its word limit in a file the branch changes. It then prints candidates (filler words that have
   term-of-art uses, speech verbs on data, delta words, headings written as claims), which need
   judgment and never fail the run. It skips this skill's own directory, because the examples here
   contain those patterns on purpose. If you're reviewing this skill, run the greps by hand and
   judge the hits.

4. The links. Walk each changed section's links and confirm the link text still matches the heading
   it points to.

## What a review report looks like

A report is a list of findings followed by a verdict. Each finding is one line:

```text
path:line — rule — "the quoted text" — the proposed fix
```

The rule is the heading of the section the finding falls under. The proposed fix is a rewritten
sentence or "delete". Group findings by pass. End with `clean` if there are no findings, or `fail`
and the count. A reviewer proposes and never edits. The writer then fixes each finding by rewriting
from the facts, not by pasting the reviewer's sentence in.
