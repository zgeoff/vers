---
name: docs-writing
description:
  How to write prose that gets committed to this repo — docs/, READMEs, AGENTS.md, and skills. Load
  it before writing, editing, or reviewing any of them.
---

# Writing docs

Committed prose describes the system as it stands today. A stranger reads it months from now, without the conversation, the ticket, or the diff that produced it. If a sentence needs that background to make sense, rewrite it. As the author you already know what every word refers to, so you cannot feel this failure yourself. Check for it on purpose.

Each doc answers two questions: what to say, and how to say it. Cut hard to decide what to say. Take care with each remaining sentence to decide how to say it. A doc tells the reader several things they need to know. For each one, state what is true and why it matters, in as many sentences as that takes. If the doc runs long, remove whole ideas instead of trimming words from the sentences you keep. If a sentence breaks a rule in this guide, start again from the facts instead of fixing it word by word. Fixing words one by one keeps the bad sentence structure.

## Deciding what to include

### Describe the system as it is now

Write about what the code does today, in the present tense. Leave out history ("previously", "now uses"), plans ("will land"), temporary states ("not wired yet"), and links to our own issue tracker. Two things that look like references are fine, because they describe the code as it is: a marker that appears verbatim in the source, like a `baseline(#236)` comment, and an upstream issue the code works around, like `turborepo#11007`.

Do not leave traces of the work session in the doc. Date stamps in prose go stale, and git already records when things happened. "Verified against…" and "I checked…" belong in the commit message. In the doc, state what you found. Never cite an agent's private memory file, because no one else can open it. Cite the source it pointed at, or leave the claim out. Dated filenames and metadata rows in a header are structure, not traces, and they stay.

The same rule applies to single words. "Also", "as well as", "in addition", "now", and "still" all describe a change from some earlier state. Keep them when the doc itself describes the earlier state. When the earlier state lives only in your head, in the conversation, or in the diff, the sentence describes your edit instead of the system. Write the resulting state. "The new endpoint" goes stale the moment the change merges, so name the endpoint.

### Cut anything the reader could get from the code

For each section, ask: with the source file open and this paragraph deleted, would the reader still know everything it says and act the same way? If yes, delete the whole section. Judge whole sections, not single sentences. Judge a sentence that orients the reader, names something, or sums up by whether it helps the reader find their way, not by whether it states a new fact.

The most common padding is defense of a decision nobody questioned. Watch for lists of edge cases that need tampering to trigger, "in case someone…" asides, and restatements of what is out of scope. If a paragraph runs past about eight lines, reread it and ask whether it defends a decision nobody attacked.

### A bug fix rarely needs a doc change

When a PR changes behavior, reread the doc that covers that behavior and rewrite whichever sentence the change made false. Do not add a paragraph for a new failure case, a tuned value, a renamed function, a new metric, or an operator procedure. Those live in the code, in a registry the code defines, or in a runbook. A doc that grows a paragraph per fix turns into a changelog.

### Architecture docs describe structure and invariants

A doc under `docs/architecture/` says how a subsystem is put together and what a caller must never break. Structure means the parts, the boundaries between them, and which part holds each piece of state. An invariant is a rule that holds whatever a caller does. State each invariant in at most three sentences: the rule, what it guarantees, and one exception if there is one.

Four things do not belong there, because each belongs elsewhere:

- A step-by-step walkthrough of how something works. The code shows that.
- The reason a decision was made. The commit message holds that.
- A defense of that decision. Leave it out.
- What the player sees. A design note under `docs/game-design/` holds that.

If the design calls for something the code does not implement yet, that is design, and it goes in a design note. Where a design decision shaped something the code does implement, link the design note in one sentence and stop there.

### Give each doc one job and each fact one home

A doc serves one reader doing one task. A fact belongs in it only if that reader needs it while doing that task. A fact that serves a different task belongs in that task's doc, with a link from this one. Open with what the subject is, not with who should read the doc or when: no "read this when…", no "this doc is for…".

Explain each fact, with its reasoning, in exactly one doc across the whole tree. That doc is the fact's home. Any other section that needs the fact states it in one sentence and links to the home doc. When two docs disagree, the home doc is right: fix the other doc, then check the home doc against the code. An index may restate owned facts at one line each, because that is what an index is for.

A system that passes values through, like a deploy pipeline or config plumbing, documents how values move through it in one place. What each value means belongs in the doc for the feature that owns the value.

### Don't copy what the code already says

Anything the code defines, describe instead of copying. A copy goes stale the next time someone changes the code, and nothing tells you. This covers four things.

#### Lists

If the repo already defines a list, such as the packages under a directory, the apps in a manifest, or the env keys a service reads, describe how the list is defined instead of writing it out.

- Bad: "The domain services — `service-activity`, `service-avatar`, `service-keys`, `service-session`, `service-user`, and `service-verification` — are private."
- Good: "The domain services (every `services/*` app) are private."

Name one member only when it behaves differently from the rest. If a list is partly defined in code and partly elsewhere, describe the rule for the code-defined members and list the others by name. You may write out two kinds of list: commands the reader runs, and a table where the list is the key column and the other columns hold facts that are not in the code.

#### Numbers

Do not put a config value in a doc: a timeout, a threshold, a retry limit, a schedule, a limit, a byte length. State the rule the number serves instead.

- Bad: "`idle_timeout` (240s) closes a pooled connection before Neon's 300s suspend closes it."
- Good: "An idle pooled connection closes before Neon's suspend closes it from the server side."

A number belongs in a doc only when the code does not decide it: a period fixed by a protocol, a limit that a design note defines, a count that is the whole idea ("three classes"), or a measurement with its source, like a bundle size or an observed latency.

#### Names

Do not refer to something by its function name, option name, column, env var, package name, or file path. A rename breaks the reference without warning. Name the role instead: "the admission handler", "the database factory".

- Bad: "`runBoundedAttempts` (`apps/web/src/lib/rpc/`) retries a GET up to three times."
- Good: "The bounded-attempt policy resends a GET when an attempt hits its bound."

You may use three kinds of identifier: an error code or wire field a client switches on, a domain term the doc defines that also happens to be an identifier (the `Started` checkpoint, `userSeed`), and a command or path the reader types.

#### Code

A code block holds a command the reader runs or a short invented example. Code that exists in the repo gets a link, not a copy. The typechecker checks the source file, not your copy of it.

## Writing the sentences

### One idea per sentence

Keep two ideas in one sentence only when the second follows directly from the first: "the tag derives from the commit, so no ref travels between jobs". If a sentence has two dash asides, or a dash aside plus a parenthetical, split it at the first dash.

- Bad: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>` — both phases derive the tag from the commit, so no ref travels between jobs — and re-running a leg overwrites its own tag."
- Good: "The build leg pushes the image as `registry.fly.io/<app>:deployment-<sha>`. Both phases derive the tag from the commit, so no ref travels between jobs. Re-running a leg overwrites its own tag."

If you put a relative clause after a dash, keep its "that" or "which". Without it, the clause reads as a second aside.

Use parentheses for identifiers, values, and short examples. Never use one to restate the sentence in other words, and never put more than one in a sentence. A consequence is not a parenthetical: give it its own sentence or put it after a colon.

### Put the main idea first

Start each paragraph with the sentence that states its main idea, and make every later sentence support it. When a sentence starts a new idea, start a new paragraph. A quick test: read only the first sentence of each paragraph. You get a correct rough version of the doc.

Inside a sentence, lead with the answer: "Reuses the existing bucket", not "What we want to do here is…". A short orienting clause is fine ("To detect a stale artifact, …"), because it tells the reader where they are before the fact arrives.

When one concrete example shows a general rule, give the example first. "The handler intercepts a request to `/admin/api/2026-07/graphql.json` and answers it from the `2026-01` schema" is better than "handlers match any version segment and answer from the pinned schema". State the general rule on its own only when no single example can show it.

### Say who does what

Name the actor. "The sweep drops each stranded machine and records which ones it removed", not "stranded machines are dropped and the removed set is recorded". Four patterns hide the actor:

- The passive voice. Add "by monkeys" to the end of the sentence. If it still parses, it is passive.
- An action disguised as a definition. "A schema review is a rewrite" hides "when you review a schema, you rewrite it".
- An object doing a person's job. A token does not "hand" the browser a session; the browser fetches one. A 400 does not "refetch"; the client refetches on a 400.
- A chain of abstract nouns with nobody in it. "The escalation path for consumers on diverging versions" stays unclear however precise it is. Rewrite it as a clause with a subject and a verb: "who to call when a client runs an older version than the server".

Sentences that state a fact or a definition have no actor, and "is" is the right verb there: "the field is optional".

When you say which doc or component holds something, make it the subject: "the overview holds the boundaries", not "the boundaries are the overview's". Do not hang a possessive on a link ("the [sweep](url)'s seven readers"). Put the link in a prepositional phrase instead ("the seven readers of the [sweep](url)").

Give each action its own verb. If you join two different actions with one vague verb like "handles", "carries", or "covers", they sound like one action, and the reader goes looking for it. "The worker drops the machine and records the removal", not "the worker handles the machine and the removal".

### Don't hedge a decision

A decided rule uses the present tense, not "may", "should", or "might". Keep those words for options that are still open. A conditional that defines a rule ("a change counts as standard-risk when…") is a definition, not hedging.

### State the rule, then the exception

Put an exception in its own sentence, after the rule. Do not fold it into the rule's sentence as a clause. If there are two or more exceptions, list them.

- Bad: "A background report sends a fresh trace id, except that a request-triggered drain inherits the originating request's trace."
- Good: "A background report sends a fresh trace id for that unit of work. One exception: a drain triggered by a request inherits that request's trace."

### Make every reference easy to resolve

A pronoun's referent sits in the same sentence or the one before. Any farther back, repeat the noun. Repeating a noun is never a fault; making the reader scroll back is.

The same goes for "the" plus a noun. If the doc mentions more than one kind of limit, "the limit" is clear only once "the rate limit" has appeared earlier in the same paragraph.

When a noun names a part of something, name the whole thing the first time: "activity start", not "start"; "chain head", not "head".

Point at the subject, not at the document. No "as noted above", no "see below", no "the second…", no "another…". Links to the section or doc that holds a fact are fine; they point at the subject. A contrast between two states of the system ("a `pruned` row means expired; a missing row means unknown") states a fact about the system and is fine.

### Use one name for each thing

Spell out an acronym the first time it appears ("Content Security Policy (CSP)"). Give a term of art a one-line definition or a link to where it is defined. Then keep using the same term. Switching words to avoid repetition ("the runner… the executor… the worker") makes the reader wonder whether those are three different things.

A verb turned into a noun ("a reveal", "the split", "an append") is a made-up term, so attach it to what it acts on ("checkpoint reveal", "partition split", "chain append") and define it on first use. Or rewrite the sentence around the verb. If a made-up term names a design concept, keep it for that concept and use a different word for the everyday sense.

### Don't stack nouns or hide behind negatives

Three bare nouns in a row force the reader to parse the sentence twice. Break them up with a preposition: "a bug in the token expiry check", not "the token expiry check bug".

Negate the verb or the object, never the subject. "A drain never delivers entries out of order", not "no drain delivers entries out of order". A negated subject reads as a claim about the subject until the verb arrives.

### Write how-to as instructions

In a how-to, address the reader as "you" and use imperatives: "seed it yourself", "call `seed()` if you'd rather not create data per test". A how-to written without a reader reads like a spec. Reference and design docs stay declarative, because there you describe what the system is, not telling the reader what to do.

## Choosing words

### Cut filler and vague qualifiers

Cut words that add nothing: "naturally", "organically", "cleanly", "honestly", "trivially", "just", "earns its complexity", "lays foundation for", "cheap insurance", "the right level". "Easy", "simple", and "quick" sound like marketing, so describe the thing instead: "one command", "on by default". Drop labels like `Mitigation:` and state the fix directly.

Replace vague qualifiers with claims. "Significantly", "many", "often", "typically", "generally", "near-instant" stand where a real claim belongs. Give the figure and its source, or make the concrete claim the qualifier avoids. "~28.7KB gzipped on average over a 7-day window" stands up in review; "artifacts are small" does not.

### Don't stack adjectives

Three or more adjectives on one noun read as marketing copy. Lead with the fact instead.

- Bad: "This work introduces continuations — session-scoped, chain-rooted, identity-bearing rows that resume an activity…"
- Good: "A continuation is a row minted from a chain coordinate. The session that owns it resumes the activity through it."

### Don't repeat the same sentence pattern

The same pattern three times in a row tires the reader. If you wrote "X, not Y" three times, keep the strongest contrast. If you wrote "no new A, no new B, no new C", collapse it to one line. If "means" or "is the" is the main verb of every sentence, vary the verbs.

### Cut the signs of machine-drafted prose

These patterns mark text as generated. Cut or rewrite them:

- Transitions that recap the previous paragraph: "With this setup complete…", "Now that we've covered…". Go straight to the next idea.
- Feature-list voice: "provides", "is configurable", "offers a flexible way to". State the fact.
- Choppy fragments that split one idea: "Previously this was manual. Now it's automatic. This saves time." Make it one sentence. A short sentence for emphasis is fine.
- Framing that could open any doc: "The question most teams face is…".
- A rhetorical question that only sets up the next sentence: "So why not cache it? Because…". Say it directly.

### Banned words

The [banned-words list in AGENTS.md](../../../AGENTS.md#banned-words) applies to all prose. Fix any violation you see.

## Shaping the doc

### Summary first

Open a doc with three to six plain sentences that say what the system does and the one thing a reader most needs to know. Open any section of four or more paragraphs with a sentence that names what it covers and the common case. Split a section that runs past six paragraphs into subsections. Bullets count as paragraphs for these limits.

### Lists for parallel items, prose for cause and effect

If a paragraph lists parallel things, make it a list. If a list's items tell a cause-and-effect story, make it a paragraph. Give each list item a fact beyond its own name; an item with nothing to add goes inline.

### Tables for variants with several attributes

When you have three or more values of one kind (states, tiers, modes) and each has two or more attributes, use a table. Do not write a chain of contrasting sentences. If each value has only one attribute, use bullets.

Keep each cell to one value: an identifier, a number, a short phrase. If you find yourself putting a list, a whole clause, or a reference to another row in a cell, the table is the wrong shape. Try these in order: point to the source file that holds the mapping; use a nested list; re-cut the table's columns. A decision table is the exception: its prose column says what each option is and when to use it, and that is fine.

### Diagrams for pipelines, state machines, and topologies

If a section covers a pipeline, a state machine, or a topology, open it with one mermaid diagram of that shape. Those three are the whole list; a section about a rule, a contract, or a set of parallel facts gets no diagram. Under the diagram, write only what the diagram cannot show: the invariant on each edge, who owns each state, the exception.

Use the same names in the diagram that the nearby prose and the subsystem's glossary use. A diagram adds no vocabulary and no nodes the prose does not mention. It shows no numbers from the code, no identifiers the prose would not use, and no defensive edge cases.

### Procedures as numbered steps

When the reader performs actions in order, write a numbered list with one action per step. If a step needs explanation, add a sentence under it instead of making the step longer. Indent a code block inside a step to the step. State the expected outcome exactly ("Expect: HTTP 202", the exact error text), never "should succeed". A checklist with no inherent order is bullets.

A sequence the system performs is a description, not instructions to the reader. Where the order is the whole idea (a pipeline, a request lifecycle), write it as numbered stages in the declarative: "1. The build job pushes the image", not "1. Push the image".

### Headings, not bold labels

A bold lead-in works for a single paragraph. Once it needs a second paragraph or a code block, it is a section, so give it a heading. This includes repeated template labels like `**Scope**` and `**Risk**` across the phases of a plan. Two shapes stay bold: a one-line marker (`**Why:**`, `**Depends on:** phase 1.`) and a run of entries that all have the same shape, like the entries in a changelog, where a heading on each one would only add noise.

Do not label a body with its own role. `**Design**`, `**Rationale**`, `## Overview`, and `## Notes` add nothing, because the body already is the design or the rationale. Name what the section covers, or fold it into the intro. Replace a per-section `**Rationale**` block with inline `**Why:**` markers at the specific decisions that need one.

Do not use `---` between sections. A horizontal rule is a heading that lost its name. Delete it, and if the break felt necessary, give the section under it a heading.

## Formatting and links

- Write each paragraph as one long line. oxfmt reflows prose on commit, so hand-wrapping creates churn. Code blocks are left as written.
- Tag every code block with a language (`bash`, `ts`, or `text` for plain output). An untagged block renders flat on GitHub.
- Attach units to their value: `200ms`, `30s`, `64KB`. Write measured counts as numerals: "8 deployments", not "eight".
- Name what a placeholder stands for: `<task_list_id>`, `<service_id>`. Never `xxx`, `ABC123`, or `<TOKEN>`.
- GitHub makes anchors by lowercasing the heading, dropping punctuation, and turning each space into a hyphen, so `## Game entropy & provenance` links as `#game-entropy--provenance`.
- Link to another doc with a path relative to the linking file.
- Link a target once, where it first matters, and refer to it by name after that.
- Never use `§`, in prose or in link text. Link the section by its title.

## Reviewing a doc

Before you commit, review each file you touched in four passes. A review subagent runs the same four passes with this guide as its only reference.

1. What it says. List what each section says and judge each one against "Deciding what to include". Check every fact against the doc that holds it.
2. How it says it. Reread each surviving paragraph against "Writing the sentences", "Choosing words", "Shaping the doc", and "Formatting and links", in that order.
3. The scripted checks. Run from the repo root:

   ```bash
   bash .claude/skills/docs-writing/scripts/check-prose.sh <path>...
   ```

   The script fails on four things: traces of the work session (date stamps, "Verified against…"), the banned words a grep can catch, numbers with units under `docs/architecture/`, and untagged code blocks. It skips this skill's own directory, because the examples here contain those patterns on purpose. If you review this skill, run the greps by hand and judge the hits.

4. The links. Walk each changed section's links and confirm the link text still matches the heading it points to.

### What a review report looks like

A report is a list of findings followed by a verdict. Each finding is one line:

```text
path:line — rule — "the quoted text" — the proposed fix
```

The rule is the heading of the section the finding falls under. The proposed fix is a rewritten sentence or "delete". Group findings by pass. End with `clean` if there are no findings, or `fail` and the count. A reviewer proposes and never edits. The writer then fixes each finding by starting again from the facts, not by pasting the reviewer's sentence in.
