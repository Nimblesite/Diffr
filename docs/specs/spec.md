# Diffr — VSCode Extension Spec

Execution plan and live TODO checklist: [../plans/plan.md](../plans/plan.md).

## Context

Diffr is a new VSCode extension whose only job is **"pick two things and diff them"** against a git repository and allow editing of the working state side. Side A is a commit; Side B can be another commit, the working copy, the index, or a branch/tag (resolved to a commit).

**KISS principle, enforced**: Diffr adds **no new views, no activity-bar icon, no tree provider, no webviews**. Everything is wired as **context-menu entries on VSCode's existing Source Control surfaces** (SCM history, SCM resource state, editor title, explorer) plus a small number of palette commands. Browsing many changed files between two commits is handled by a **multi-step QuickPick**, not a persistent panel. The user already has a Rust LSP framework (`lsp_toolkit`) and Rust+TS extension precedent (`GithubIssues`) — both explicitly rejected for Diffr.

## Stack decision: pure TypeScript

LSP exposes **language** semantics (completion, hover, diagnostics). Diffr does none of that — it shells out to `git` and hands two URIs to `vscode.diff`. A Rust LSP adds per-platform binaries, IPC plumbing, and deployment complexity for zero capability or perf gain. Match the existing [CommandTree](../../../CommandTree) TS-only structure.

## Non-negotiables (inherited from CommandTree CLAUDE.md)

- `Result<T,E>` discriminated union — **no thrown exceptions** except panic-level bugs
- Strict TypeScript (`strict: true`), no `any`, no `!`, no `@ts-ignore`, no untyped casts
- Functions < 20 lines, files < 450 lines
- **No regex on structured data** — git porcelain output parsed via NUL-delimiters
- **Providers decoupled from `vscode` SDK** — VSCode-binding shells wrap pure logic
- Named constants in one location; named parameters for 3+ args
- pino structured logging → file + VSCode OutputChannel; no PII, no secrets
- 100% coverage goal, ratchet-only via `coverage-thresholds.json`
- E2E = black-box only via VSCode commands/UI; unit tests for isolation only
- Seven Makefile targets: `build`, `test`, `lint`, `fmt`, `clean`, `ci`, `setup` (+ `package`)

## UX surface (context menus only)

```
SCM history view, right-click a commit:
  ├── Diffr: Compare with…              → SideBPicker → diff (single file) or multi-file QuickPick
  ├── Diffr: Compare with Working Copy  → multi-file QuickPick → diff
  └── Diffr: Compare with Previous      → diff against commit^1

SCM Changes view, right-click a changed file:
  └── Diffr: Compare with Commit…       → CommitPicker → diff this file at picked commit vs working copy

Editor title bar / Explorer, right-click a file:
  └── Diffr: Compare with Commit…       → CommitPicker → diff this file at picked commit vs working copy

Command palette:
  ├── Diffr: Compare Two Commits        → CommitPicker → SideBPicker → file QuickPick → diff
  ├── Diffr: Compare Current File with Commit
  └── Diffr: Reopen Last Comparison
```

**Browsing many changed files between two commits**: after Side A and Side B are picked, show a `QuickPick<FileItem>` listing all changed files with `+N -M` in the description and `A/M/D/R/C` status as the detail. Picking a file opens `vscode.diff`; the QuickPick stays open (`ignoreFocusOut: true`) so the user can dismiss the diff and pick another file. **This replaces the tree view entirely.**

## Project layout

```
/Users/christianfindlay/Documents/Code/Diffr/
├── .github/workflows/{ci.yml,release.yml}
├── .vscode-test.mjs
├── Makefile
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── .prettierrc.json
├── coverage-thresholds.json
├── cspell.json
├── icon.png
├── README.md
├── CHANGELOG.md
├── LICENSE
├── CLAUDE.md                       # copied from CommandTree, project-specific edits
├── docs/
│   ├── specs/spec.md               # this file
│   └── plans/plan.md               # phased execution plan + TODO checklist
├── src/
│   ├── extension.ts                # activate/deactivate; command + provider registration ONLY
│   ├── constants.ts                # command IDs, scheme name, context keys
│   ├── result.ts                   # Result<T,E>
│   ├── logger.ts                   # pino + OutputChannel sink
│   ├── state.ts                    # Memento wrapper: lastComparison
│   ├── git/
│   │   ├── GitRunner.ts            # subprocess exec → Result<string, GitError>
│   │   ├── GitRepo.ts              # log, nameStatus, numstat, show, revParse, refs
│   │   ├── parsers.ts              # NUL-delimited porcelain parsers (no regex)
│   │   └── types.ts                # Commit, ChangedFile, DiffStat, RevSpec, Ref
│   ├── providers/
│   │   └── DiffrContentProvider.ts # TextDocumentContentProvider for diffr://
│   ├── ui/
│   │   ├── CommitPicker.ts         # QuickPick over git log
│   │   ├── RefPicker.ts            # branches + tags, resolves to RevSpec
│   │   ├── SideBPicker.ts          # Commit | Working Copy | Index | Branch/Tag
│   │   ├── FilePicker.ts           # QuickPick over changed files with stats
│   │   └── uri.ts                  # buildDiffrUri / parseDiffrUri (pure)
│   ├── commands/
│   │   ├── compareWith.ts          # SCM-history "Compare with…" entry
│   │   ├── compareWithWorkingCopy.ts
│   │   ├── compareWithPrevious.ts
│   │   ├── compareTwoCommits.ts    # palette
│   │   ├── compareFileWithCommit.ts # editor/explorer/SCM-resource "Compare with Commit…"
│   │   └── reopenLast.ts
│   └── test/
│       ├── unit/                   # mocha, no vscode
│       │   ├── parsers.test.ts
│       │   ├── uri.test.ts
│       │   └── result.test.ts
│       └── suite/                  # @vscode/test-electron, black-box only
│           ├── activation.test.ts
│           ├── compareTwoCommits.test.ts
│           ├── compareFileWithCommit.test.ts
│           └── contentProvider.test.ts
└── test-fixtures/
    └── repo-seed/                  # script-built throwaway git repo for E2E
```

## Core modules

- **`git/GitRunner.ts`** — `run(args: readonly string[], cwd: string): Promise<Result<string, GitError>>`. Spawns `git`, captures stdout/stderr, never throws. Logs entry/exit at `debug`.
- **`git/GitRepo.ts`** — Domain wrapper. Methods:
  - `log({ limit, ref? }): Promise<Result<readonly Commit[], GitError>>` → `git log --format=%H%x00%h%x00%an%x00%at%x00%s -z`
  - `nameStatus({ from, to }): Promise<Result<readonly ChangedFile[], GitError>>` → `git diff --name-status -z`
  - `numstat({ from, to }): Promise<Result<readonly DiffStat[], GitError>>` → `git diff --numstat -z`
  - `show({ rev, path }): Promise<Result<string, GitError>>` → `git show <rev>:<path>`
  - `refs(): Promise<Result<readonly Ref[], GitError>>` → `git for-each-ref --format='%(refname:short)%00%(objectname)%00%(objecttype)'`
  - `revParse(name): Promise<Result<Sha, GitError>>`
- **`providers/DiffrContentProvider.ts`** — `TextDocumentContentProvider` for scheme `diffr`. URI shapes:
  - `diffr://commit/<sha>/<relpath>` → `git show <sha>:<path>`
  - `diffr://index/<relpath>` → `git show :<path>` (fallback when built-in git ext's `toGitUri` is unavailable)
  Returns empty string for deleted files. Pure dispatch — URI parse + GitRepo call.
- **`ui/CommitPicker.ts`** / **`RefPicker.ts`** / **`SideBPicker.ts`** / **`FilePicker.ts`** — `vscode.window.createQuickPick<T>()` wrappers returning `Result<T, Cancelled>`. SideB prepends synthetic items: `WORKING_COPY`, `INDEX`, `BRANCH_OR_TAG…` (last opens RefPicker). FilePicker stays open after selection so multiple files can be diffed in sequence from one comparison.
- **`ui/uri.ts`** — `buildDiffrUri(rev, path): Uri`, `parseDiffrUri(uri): Result<{rev, path}, ParseError>`. Pure, unit-tested. Handles spaces/unicode/`#`/`?` via proper URI encoding.
- **Types**
  - `RevSpec = { kind: 'commit', sha: string } | { kind: 'workingCopy' } | { kind: 'index' }` — refs resolve to `commit` before reaching anything downstream.
  - `uriFor(rev, absPath, relPath)`:
    - `commit` → `diffr://commit/<sha>/<relpath>`
    - `workingCopy` → `Uri.file(absPath)`
    - `index` → built-in git extension's `toGitUri(fileUri, '~')` if available, else `diffr://index/<relpath>`

## `package.json` contributions

```jsonc
{
  "activationEvents": ["onStartupFinished"],
  "extensionDependencies": ["vscode.git"],
  "contributes": {
    "commands": [
      { "command": "diffr.compareWith",              "title": "Diffr: Compare with…" },
      { "command": "diffr.compareWithWorkingCopy",   "title": "Diffr: Compare with Working Copy" },
      { "command": "diffr.compareWithPrevious",      "title": "Diffr: Compare with Previous" },
      { "command": "diffr.compareTwoCommits",        "title": "Diffr: Compare Two Commits" },
      { "command": "diffr.compareFileWithCommit",    "title": "Diffr: Compare with Commit…" },
      { "command": "diffr.reopenLast",               "title": "Diffr: Reopen Last Comparison" }
    ],
    "menus": {
      "scm/history/item/context": [
        { "command": "diffr.compareWith",            "when": "scmProvider == git", "group": "diffr@1" },
        { "command": "diffr.compareWithWorkingCopy", "when": "scmProvider == git", "group": "diffr@2" },
        { "command": "diffr.compareWithPrevious",    "when": "scmProvider == git", "group": "diffr@3" }
      ],
      "scm/resourceState/context": [
        { "command": "diffr.compareFileWithCommit",  "when": "scmProvider == git", "group": "diffr@1" }
      ],
      "editor/title/context": [
        { "command": "diffr.compareFileWithCommit",  "when": "resourceScheme == file", "group": "3_compare" }
      ],
      "explorer/context": [
        { "command": "diffr.compareFileWithCommit",  "when": "resourceScheme == file && !explorerResourceIsFolder", "group": "3_compare" }
      ],
      "commandPalette": [
        { "command": "diffr.compareWith",            "when": "false" },
        { "command": "diffr.compareWithWorkingCopy", "when": "false" },
        { "command": "diffr.compareWithPrevious",    "when": "false" }
      ]
    }
  }
}
```

The three SCM-history commands receive the commit object as an argument from VSCode; the file/SCM-resource commands receive a `Uri`/`SourceControlResourceState`. Palette-only commands (`compareTwoCommits`, `compareFileWithCommit`, `reopenLast`) take no arguments and prompt for everything.

## Execution flows

**SCM history: "Compare with…"** (entry point passes the commit)
```
diffr.compareWith(historyItem)
  → revA = { kind:'commit', sha: historyItem.id }
  → SideBPicker → revB
  → GitRepo.nameStatus({ from: revA, to: revB }) + numstat
  → FilePicker(files, stats) — stays open
    → on pick: vscode.diff(uriFor(revA, path), uriFor(revB, path), title)
  → state.saveLast({ revA, revB })
```

**SCM history: "Compare with Working Copy"** — same flow, `revB = { kind:'workingCopy' }`, no SideBPicker.

**SCM history: "Compare with Previous"** — `revB = { kind:'commit', sha: <historyItem.id>^1 }`, no SideBPicker.

**Palette: "Compare Two Commits"**
```
diffr.compareTwoCommits
  → resolve repo via vscode.git API (auto if single)
  → GitRepo.log({ limit:200 }) → CommitPicker → revA
  → SideBPicker → revB
  → FilePicker → diff (same loop as above)
```

**Editor/Explorer/SCM-resource: "Compare with Commit…"**
```
diffr.compareFileWithCommit(uri)
  → GitRepo.log → CommitPicker → rev
  → leftUri  = buildDiffrUri({ kind:'commit', sha:rev }, relPath)
  → rightUri = uri  (file://)
  → vscode.diff(leftUri, rightUri, `${shortSha} ↔ Working Copy — ${basename}`)
```

## Testing strategy

**Unit (`src/test/unit/`, mocha, no VSCode):**
- `parsers.test.ts` — NUL-delimited log; name-status `A/M/D/R/C` with similarity scores; numstat with binary `-`/`-` markers; empty input; malformed → `Err`
- `uri.test.ts` — round-trip `build → parse`; paths with spaces, unicode, `#`, `?`; reject malformed
- `result.test.ts` — combinators if added

**E2E (`src/test/suite/`, `@vscode/test-electron`, black-box only):**
- `activation.test.ts` — extension activates; all commands registered (`vscode.commands.getCommands(true)`)
- `compareTwoCommits.test.ts` — invoke palette command against fixture repo; assert FilePicker opens with expected file list; selecting a file opens a `TabInputTextDiff` tab (poll `vscode.window.tabGroups.all`)
- `compareFileWithCommit.test.ts` — open a fixture file, invoke command, assert diff tab opens with expected `diffr://` left URI
- `contentProvider.test.ts` — `workspace.openTextDocument(Uri.parse('diffr://commit/<sha>/file.txt'))` returns the historical content from the seed repo

Coverage starts at 80% in `coverage-thresholds.json`; ratchet-only.

## Out of scope for v1

Custom diff renderer; activity-bar icon; sidebar / tree view; webviews; blame; merge conflict UI; three-way diff; stash diffing; GitHub/GitLab PR integration; remote-fetch on demand; submodule support; LFS-aware preview; per-hunk staging; binary file preview.

## IntelliJ portability (noted, not pursued)

`src/git/` (Runner, Repo, parsers, types) and `src/ui/uri.ts` are pure subprocess + string parsing — directly portable to Kotlin against `Git4Idea`. `RevSpec` / `ChangedFile` shapes port verbatim. Everything else is VSCode-API-specific (`vscode.diff` → `DiffManager.showDiff`; `TextDocumentContentProvider` → `VirtualFile`/`FileEditorProvider`; QuickPick → `JBPopupFactory`). Not worth pre-factoring; revisit on user demand.
