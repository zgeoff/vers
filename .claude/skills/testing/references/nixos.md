# NixOS testing

NixOS tests separate evaluation, generated-file builds, and running systems. Preserve the shared
[behavioral principles](../SKILL.md#principles) through those native layers. Bun's test syntax,
preloads, matcher types, and file layout do not apply.

## Evaluation and generated files

- Evaluate module defaults, generated configuration, and invalid option combinations without booting
  a VM. Keep scenario options visible and derive expected values independently of the module's own
  calculation.
- Use named `expr`/`expected` cases for pure evaluation checks. A project can use Nixpkgs'
  `lib.debug.runTests`; select nix-unit when cases need independent reporting of evaluation errors.
  Pin the runner and check compatibility with the project's Nix implementation.
- Reuse immutable VM/module definitions and infrastructure defaults. Sharing a pure definition does
  not share mutable test state. Keep the options that select a case in that case.
- Build generated files before checks that must read their contents. Preserve these checks when
  adopting an evaluation runner; an evaluator does not replace build-time behavior.

## System journeys

Use the NixOS test driver for boot, systemd, kernel, networking, and storage behavior. Give subtests
behavioral names. Group dependent configuration transitions as one journey; unrelated scenarios need
a tested baseline reset or a fresh environment. Reuse expensive infrastructure under the shared
[journey rules](../SKILL.md#end-to-end-suites); a VM per assertion is not an isolation requirement.

Use driver condition waits such as `wait_for_unit` and `wait_until_succeeds`, with bounded failure.
A delay that guesses when a service settles is not readiness. Kernel and real-process behavior stays
real; follow the shared [timer and pacing rules](../SKILL.md#native-timers-and-scenario-delays).

Check each meaningful observation separately. Compare intended values and command results, not only
whether a command ran or any error occurred. `machine.fail` proves a nonzero exit; a case that names
a refusal also checks its exit/output contract. Python assertion guards and driver subtest context
managers are native test mechanisms, not forbidden Bun branching or describe blocks.

The driver/harness releases VMs and acquired infrastructure even after failure. Test any shared
reset against dirty state. Fixed guest paths belong to that isolated environment; host-global
resources follow [resource ownership](../SKILL.md#program-fixed-paths-and-global-resources).
Unrelated cases cannot inherit tokens, files, mounts, or service settings from earlier cases.

## Reports and CI

Wire evaluation, generated-file, and VM checks into explicit flake/package commands and CI. Preserve
per-case diagnostics and timings. A required gate reports a result for every PR and fails on missing
expected coverage or a non-successful required check. Select expensive checks inside that gate
rather than skipping its entire workflow with path filters.

Native APIs: [NixOS test manual](https://nixos.org/manual/nixos/stable/#sec-nixos-tests) and
[Nixpkgs test helpers](https://nixos.org/manual/nixpkgs/stable/#sec-lib-debug). Runner API:
[nix-unit](https://nix-community.github.io/nix-unit/).
