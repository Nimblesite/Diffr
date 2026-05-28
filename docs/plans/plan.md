# Diffr — Execution Plan

Full design spec: [../specs/spec.md](../specs/spec.md). This file is the **how + when** — phased milestones and a live TODO checklist at the bottom. The checklist is the source of truth for "what's left." Tick boxes as work lands; never delete unchecked items without justification in the PR description.

## Goal

Ship Diffr v1.0.0 as a VSCode extension that lets a developer pick two git references (commit/working-copy/index/branch/tag) and diff them through VSCode's built-in `vscode.diff`, surfaced exclusively through existing SCM/editor/explorer context menus and a handful of palette commands. No new views, sidebars, activity-bar icons, or webviews. KISS, A+ codebase, 100% coverage goal with ratchet-only thresholds.

## Phases

Each phase ends with a hard checkpoint. **A phase is not done until its checkpoint passes** — no advancing with red tests.

### Phase 0 — Repo scaffold

Get the empty repo to a state where `make ci` runs end-to-end (lint + test + build) against a single trivial source file. Establish coding-standards plumbing before any feature code is written.

**Checkpoint:** `make ci` passes on a CI matrix (macOS + Linux + Windows) with one placeholder test that asserts a constant equals itself. Coverage threshold initialized at `0.0` in `coverage-thresholds.json`; ratchet starts from the first real test.

### Phase 1 — Pure logic + unit tests

Build everything that has zero `vscode` imports: `Result<T,E>`, `constants`, all of `src/git/`, and `src/ui/uri.ts`. Cover with mocha unit tests in `src/test/unit/`. This is the layer that would port to IntelliJ unchanged.

**Checkpoint:** Unit tests assert NUL-delimited parsers handle every status code (`A/M/D/R<NNN>/C<NNN>`), binary numstat markers, empty git output, malformed git output (→ `Err`). URI codec round-trips paths with spaces, unicode, `#`, `?`. Coverage threshold ratchets up.

### Phase 2 — VSCode integration

Wire the pure logic into VSCode: `extension.ts`, `DiffrContentProvider`, the four picker shells (`CommitPicker`, `RefPicker`, `SideBPicker`, `FilePicker`), the six command handlers, the full `package.json` `contributes` block, and the `logger`/`state` modules. Implement the `vscode.git` API consumer (repo resolution).

**Checkpoint:** Extension activates in an Extension Development Host; all six commands appear in the palette; `activation.test.ts` (E2E) asserts every command ID is registered. The `diffr://` scheme resolves through `DiffrContentProvider` against the seed repo.

### Phase 3 — Full E2E coverage

Drive each command end-to-end through black-box tests using `@vscode/test-electron` against `test-fixtures/repo-seed/`. Replace any internal-call shortcuts with real command invocations.

**Checkpoint:** E2E suite covers `compareTwoCommits`, `compareFileWithCommit`, `compareWith`, `compareWithWorkingCopy`, `compareWithPrevious`, `reopenLast`, and the `diffr://` content provider. Polling on `vscode.window.tabGroups.all` confirms `TabInputTextDiff` tabs open with the expected left/right URIs and human-readable titles. Coverage threshold ratchets to ≥80%.

### Phase 4 — UX polish + observability

Wire pino → file + OutputChannel; finalize diff titles (`${shortShaA} ↔ ${shortShaB} — ${basename}`); add helpful error UX for the failure modes (not in a repo, no commits, deleted file on Side A, etc.); add the `Diffr: Reopen Last Comparison` memento round-trip; flesh out README, CHANGELOG (0.1.0 entry), LICENSE.

**Checkpoint:** Manual smoke (all 8 scenarios from the spec's Verification section) passes in a real repo. OutputChannel surfaces errors in plain English with a "Show Logs" button or hint. No PII, no secrets, no commit messages in logs.

### Phase 5 — Release

Add icon, finalize publisher metadata, build VSIX, install in a clean VSCode, rerun manual smoke. Tag `v0.1.0` and push to the marketplace (or hold for user). GitHub Actions `release.yml` builds the VSIX on tag.

**Checkpoint:** `make package` produces a loadable VSIX; clean-install smoke passes; `release.yml` artifact attached to tag.

## Open questions / decisions deferred to implementation

- Default commit list limit for `CommitPicker` — start at 200, surface a "Load more" item if needed (v1.1 if heavy).
- `Index` URI: prefer built-in `toGitUri(fileUri, '~')` when the git extension exposes it; fall back to `diffr://index/<path>`. Decide at implementation time which path is reachable from the public `vscode.git` API surface.
- Multi-repo workspaces: if more than one repo is open, prompt for repo via QuickPick before showing the commit list. No global preference for v1.
- Telemetry: **none** for v1. Revisit only with explicit user opt-in.

## Risk register

- **Built-in `vscode.git` API surface drift.** Pin against the `git.d.ts` shape at the version of VSCode in `engines.vscode`. E2E catches breakage.
- **SCM history view contributions stability.** `scm/history/item/context` is relatively new; if it disappears or moves, palette + editor/explorer entries still cover the core flows.
- **Subprocess `git` not on PATH.** Detect at activation; show a single warning in the OutputChannel and disable commands via a context key (`diffr.gitAvailable`). No popups.
- **Large repos / slow `git log`.** Cap log fetch at `--max-count=200` by default; surface latency in `debug` logs.

---

## TODO

> Tick boxes as work lands. Never delete unchecked items silently — call out scope changes in the PR description.

### Phase 0 — Repo scaffold

- [ ] Create `.gitignore` (node_modules, out, dist, .vscode-test, coverage, *.vsix)
- [ ] Create `package.json` skeleton: `name`, `displayName`, `description`, `version: 0.0.1`, `publisher`, `engines.vscode`, `extensionDependencies: ["vscode.git"]`, `activationEvents: ["onStartupFinished"]`, `main: "./out/extension.js"`, empty `contributes`
- [ ] Add dev deps: `typescript`, `@types/node`, `@types/vscode`, `@types/mocha`, `mocha`, `@vscode/test-electron`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`, `pino`, `pino-pretty`, `c8` (or `nyc`), `cspell`
- [ ] Create `tsconfig.json` with `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `module: commonjs`, `outDir: out`, `rootDir: src`
- [ ] Create `eslint.config.mjs` (flat config) wiring `@typescript-eslint`; ban `any`, `!`, `@ts-ignore`, `@ts-nocheck`, untyped casts; max-lines 450; max-lines-per-function 20
- [ ] Create `.prettierrc.json` (match CommandTree's settings)
- [ ] Create `cspell.json` with project-specific dictionary entries (`Diffr`, `numstat`, `revparse`, `pino`, etc.)
- [ ] Create `coverage-thresholds.json` with `{ "default_threshold": 0.0 }` — ratchet from first real test
- [ ] Create `Makefile` with 7 targets (`build`, `test`, `lint`, `fmt`, `clean`, `ci`, `setup`) + repo-specific `package` below a horizontal marker
- [ ] Create `.vscode-test.mjs` pointing at `out/test/suite/**/*.test.js`
- [ ] Create `.github/workflows/ci.yml`: matrix on `ubuntu-latest`, `macos-latest`, `windows-latest`; runs `make ci`; uploads coverage as artifact
- [ ] Create `.github/workflows/release.yml`: triggered on `v*` tag; runs `make package`; attaches `.vsix` to the GitHub Release
- [ ] Create `LICENSE` (MIT, copyright Christian Findlay)
- [ ] Create `README.md` skeleton (title, one-line pitch, install link, screenshot placeholder, "How to use" stub)
- [ ] Create `CHANGELOG.md` with `## [Unreleased]` header
- [ ] Add `icon.png` placeholder (128x128)
- [ ] Write one placeholder test in `src/test/unit/smoke.test.ts` asserting `1 === 1` so coverage tooling exits clean
- [ ] Verify `make ci` passes locally and in CI

### Phase 1 — Pure logic + unit tests

- [ ] `src/constants.ts` — command IDs, scheme name (`diffr`), context keys, default log limit (200), built-in command IDs (`vscode.diff`)
- [ ] `src/result.ts` — `Result<T,E>` discriminated union; `ok`, `err`, `isOk`, `isErr`, `map`, `andThen`, `unwrapOr` helpers
- [ ] `src/test/unit/result.test.ts` — round-trip + every combinator
- [ ] `src/git/types.ts` — `Sha`, `Commit`, `ChangedFileStatus` (`A|M|D|R|C`), `ChangedFile`, `DiffStat`, `RevSpec`, `Ref`, `GitError`
- [ ] `src/git/parsers.ts` — `parseLog`, `parseNameStatus`, `parseNumstat`, `parseRefs`; NUL-delimited only; **no regex on git output**
- [ ] `src/test/unit/parsers.test.ts` — every status code (`A`, `M`, `D`, `R<NNN>`, `C<NNN>`), binary numstat (`-\t-`), empty input, malformed → `Err`, paths with spaces / unicode / quotes
- [ ] `src/git/GitRunner.ts` — `run({ args, cwd })` spawning `git`, capturing stdout/stderr, never throws, returns `Result<string, GitError>`; entry/exit `debug` logs
- [ ] `src/git/GitRepo.ts` — `log`, `nameStatus`, `numstat`, `show`, `refs`, `revParse`; named-param objects; each method <20 lines
- [ ] `src/ui/uri.ts` — pure `buildDiffrUri(rev, path)` / `parseDiffrUri(uri)`; ZERO `vscode` imports (use Node `URL` or a tiny custom encoder)
- [ ] `src/test/unit/uri.test.ts` — round-trip every RevSpec kind; paths with spaces, unicode, `#`, `?`; reject malformed → `Err`
- [ ] Ratchet `coverage-thresholds.json` to current measured value minus 1% rounding
- [ ] Verify `make test` and `make lint` pass

### Phase 2 — VSCode integration

- [ ] `src/logger.ts` — pino base logger + custom transport writing to extension `globalStorageUri` log file AND mirroring `info+` to a `vscode.OutputChannel("Diffr")`
- [ ] `src/state.ts` — `MementoStore` wrapper with typed `getLastComparison()` / `setLastComparison()`; single global-state surface
- [ ] `src/providers/DiffrContentProvider.ts` — implements `TextDocumentContentProvider`; pure dispatch `parseDiffrUri` → `GitRepo.show`; empty string for deleted files
- [ ] `src/ui/CommitPicker.ts` — `pickCommit({ repo, limit })` returning `Result<Sha, Cancelled>`; label = `${shortSha}`, description = `${subject}`, detail = `${author} • ${relativeTime}`
- [ ] `src/ui/RefPicker.ts` — `pickRef({ repo })` listing branches + tags; resolves to `{ kind:'commit', sha }` via `revParse`
- [ ] `src/ui/SideBPicker.ts` — `pickSideB({ repo })`; prepends synthetic `WORKING_COPY`, `INDEX`, `BRANCH_OR_TAG…` items; last item chains into `RefPicker`
- [ ] `src/ui/FilePicker.ts` — `pickFiles({ files, stats, onPick })`; `ignoreFocusOut: true`; stays open after each pick so user can dismiss diff and pick another; description shows `+N -M`, detail shows `A/M/D/R/C`
- [ ] `src/commands/compareWith.ts` — handler taking VSCode `historyItem` argument; SideBPicker → nameStatus + numstat → FilePicker
- [ ] `src/commands/compareWithWorkingCopy.ts` — same, but `revB = { kind:'workingCopy' }`
- [ ] `src/commands/compareWithPrevious.ts` — same, but `revB = { kind:'commit', sha: <historyItem.id>^1 }` via `revParse`
- [ ] `src/commands/compareTwoCommits.ts` — palette entry; resolve repo (auto if single, else QuickPick); CommitPicker → SideBPicker → FilePicker
- [ ] `src/commands/compareFileWithCommit.ts` — accepts `Uri` arg (or falls back to `activeTextEditor`); CommitPicker → `vscode.diff(diffrUri, fileUri, title)`
- [ ] `src/commands/reopenLast.ts` — read from `MementoStore`; re-derive nameStatus + numstat; re-open FilePicker; no-op with toast if no last comparison
- [ ] `src/extension.ts` — `activate()` registers content provider, OutputChannel, all six commands; sets `diffr.gitAvailable` context key based on git binary detection; `deactivate()` disposes everything
- [ ] `package.json` — finalize `contributes.commands` (6 entries) and `contributes.menus` (5 menu IDs + `commandPalette` hides) per spec
- [ ] Activation E2E (`src/test/suite/activation.test.ts`) — `vscode.commands.getCommands(true)` includes all 6 IDs; `vscode.extensions.getExtension('<id>').isActive === true`
- [ ] Verify in Extension Development Host: all commands visible in palette; right-clicking SCM history shows three entries; right-clicking explorer file shows "Compare with Commit…"

### Phase 3 — Full E2E coverage

- [ ] `test-fixtures/repo-seed/seed.sh` — script that builds a deterministic git repo with 3 commits modifying `a.txt`, `b.txt`, `dir/c.txt`, renaming `b.txt → b2.txt`, deleting `d.txt`; fixed author + timestamps
- [ ] Wire `seed.sh` into the test bootstrap (`@vscode/test-electron` `extensionTestsEnv` opens the seeded folder as the workspace)
- [ ] `src/test/suite/contentProvider.test.ts` — `openTextDocument(Uri.parse('diffr://commit/<sha>/a.txt'))` returns expected content for each of the 3 commits; deleted file returns empty string
- [ ] `src/test/suite/compareTwoCommits.test.ts` — black-box invoke `diffr.compareTwoCommits`; stub QuickPick via test harness; assert FilePicker lists exactly the expected files with correct `+N -M`; pick one file; poll `vscode.window.tabGroups.all` for a `TabInputTextDiff` with the expected left/right URIs; assert title is human-readable
- [ ] `src/test/suite/compareFileWithCommit.test.ts` — open a fixture file; invoke command; assert diff tab opens; left URI scheme is `diffr:`; right URI scheme is `file:`; title matches `${shortSha} ↔ Working Copy — ${basename}`
- [ ] `src/test/suite/compareWith.test.ts` — invoke with a synthetic `historyItem` arg pointing at commit 2; SideB = Working Copy; assert FilePicker populates; pick a file; assert diff opens
- [ ] `src/test/suite/compareWithPrevious.test.ts` — invoke with commit 2; assert diff opens between commit 1 (`^1`) and commit 2
- [ ] `src/test/suite/reopenLast.test.ts` — run `compareTwoCommits`, dismiss; run `diffr.reopenLast`; assert FilePicker re-populates with same files
- [ ] Add assertions to existing E2E tests rather than creating new ones where feasible (per CLAUDE.md "loads of assertions per test")
- [ ] Ratchet `coverage-thresholds.json` to ≥80%

### Phase 4 — UX polish + observability

- [ ] Confirm diff titles everywhere match `${shortShaA} ↔ ${shortShaB} — ${basename}` / `${shortSha} ↔ Working Copy — ${basename}` / `${shortSha} ↔ Index — ${basename}`
- [ ] Error UX: not in a git repo → toast + OutputChannel hint; no commits in log → toast; deleted file on Side A → diff opens with empty left pane (no error); subprocess git missing → activation-time warning + commands disabled via `diffr.gitAvailable` context key
- [ ] OutputChannel: "Diffr" channel shows all `info+` entries; one-line "Show Logs" hint in error toasts via `command:diffr.showLogs` (internal-only command, not contributed to palette)
- [ ] Confirm logger redaction: assert in unit tests that file contents, commit messages, and full paths are never present in serialized log records
- [ ] Flesh out `README.md`: install instructions, animated GIF placeholder, every command with a screenshot placeholder, "How does this differ from built-in Git?" section, link to spec/plan
- [ ] `CHANGELOG.md` — `## [0.1.0]` entry summarizing every shipping command
- [ ] Re-run all 8 manual smoke scenarios from spec.md's Verification section in a real repo
- [ ] Ratchet `coverage-thresholds.json` to current measured value minus 1%

### Phase 5 — Release

- [ ] Replace placeholder `icon.png` with the final 128x128 PNG (and a 256x256 marketplace asset)
- [ ] Set `publisher` to `nimblesite` (or chosen ID) in `package.json`; verify `engines.vscode` matches the lowest API surface actually used
- [ ] `make package` produces `diffr-0.1.0.vsix`
- [ ] Install the VSIX in a clean VSCode profile; rerun the 8 manual smoke scenarios
- [ ] Tag `v0.1.0`; verify `release.yml` builds and attaches the VSIX to the GitHub Release
- [ ] (Hold for explicit user approval before `vsce publish` to the marketplace)

### Cross-cutting hygiene (run before every phase checkpoint)

- [ ] `make lint` clean (no suppressions)
- [ ] `make fmt CHECK=1` clean
- [ ] `make test` green and coverage ≥ threshold
- [ ] `make build` produces `out/extension.js`
- [ ] `make ci` green in GitHub Actions on all three OS runners
- [ ] No `console.log` anywhere in `src/`
- [ ] No file in `src/` exceeds 450 lines
- [ ] No function in `src/` exceeds 20 lines
- [ ] `src/git/` and `src/ui/uri.ts` contain ZERO `vscode` imports (grep + assert in CI)
