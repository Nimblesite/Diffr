<!-- agent-pmo:a72c926 -->

# Diffr — Agent Instructions

⚠️ **ACT AUTONOMOUSLY. DO NOT STOP TO ASK THE USER QUESTIONS.** When something is ambiguous, pick the most reasonable default, note the assumption, and work to completion. Deliver finished work plus a short summary of any assumptions you made. ⚠️

⚠️ DO NOT KILL VSCODE PROCESSES ⚠️

⚠️ **TOKEN DISCIPLINE.** Check file size first. `Grep` over `Read`. Use `offset`/`limit`.
Smallest diff that solves the problem. Delete dead code, unused imports, stale comments.
Call out irrelevant context before proceeding. Bloat degrades reasoning. ⚠️

⚠️ **CRITICAL: THIS CODEBASE RECEIVES A GRADE OF A+.** WE DON'T ALLOW BAD CODE. NOT EVEN FOR ONE LINE. CODE MUST PASS REVIEW AT Google / Meta / Microsoft. ANYTHING LESS IS ⛔️ ILLEGAL AND MUST BE FIXED IMMEDIATELY.⚠️

⚠️ **KEEP THE UI MINIMAL.** Default to VSCode's existing surfaces — SCM history, SCM resource state, editor title, and explorer context menus, plus a small set of palette commands. Avoid building new views, sidebars, activity-bar icons, tree providers, or webviews **unless the UI is an integral part of the flow** and no built-in surface can carry it well. When custom UI does earn its place, it must be first-class — not a half-measure bolted onto a picker.⚠️

Full design + execution plan: [docs/specs/spec.md](docs/specs/spec.md). Delivery plan: [docs/plans/plan.md](docs/plans/plan.md). Visual language: [docs/design-system.md](docs/design-system.md).

## Project Overview

**Diffr** is a VSCode extension that does exactly one thing: **pick two things and diff them** against a git repository. Side A is a commit; Side B is another commit, the working copy, the index, or a branch/tag (resolved to a commit). It shells out to `git`, hands two URIs to VSCode's built-in `vscode.diff`, and browses many changed files through a focused selection UI. The UI stays minimal — built-in surfaces first, purpose-built UI only when it's integral to the flow.

**Primary language:** TypeScript (pure — Rust LSP was considered and rejected; LSP is for _language_ semantics, not diffing)
**Build command:** `make ci`
**Test command:** `make test`
**Lint command:** `make lint`

There are 7 standard make targets: `build`, `test`, `lint`, `fmt`, `clean`, `ci`, `setup`. Repo-specific targets sit below a horizontal marker. `make package` builds the VSIX and `make rebuild-install-vsix` does a full uninstall → clean → build → package → install cycle. `make test` runs fail-fast, collects coverage, asserts measured ≥ threshold from `coverage-thresholds.json`, and exits non-zero on any failure.

## Architecture (one-line per layer)

```
context-menu / palette command
  → ui/* QuickPick (CommitPicker | SideBPicker | RefPicker)
  → git/GitRepo  → git/GitRunner (subprocess)
  → providers/DiffrContentProvider (TextDocumentContentProvider for diffr://)
  → vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)
```

- **`src/git/`** — pure logic. No `vscode` imports. Subprocess wrapper + NUL-delimited porcelain parsers. Trivially portable to IntelliJ/Kotlin if anyone ever wants that.
- **`src/providers/DiffrContentProvider.ts`** — `TextDocumentContentProvider` for scheme `diffr`. URI parse + GitRepo call. Pure dispatch.
- **`src/ui/`** — `vscode.window.createQuickPick<T>()` wrappers. Each returns `Result<T, Cancelled>`.
- **`src/commands/`** — one file per command. Glue only; logic lives in `git/` and `ui/`.
- **`src/extension.ts`** — activate/deactivate; command + provider registration ONLY. No business logic.
- **Global state** lives in exactly one file: `src/state.ts` (Memento wrapper for last comparison). Nothing escapes it.

## Hard Rules (no exceptions, NON-NEGOTIABLE)

- **Keep UI minimal.** Prefer context menus, palette commands, and other built-in surfaces. Add new views, sidebars, tree providers, or webviews only when the UI is integral to the flow and no built-in surface fits — and when you do, build it properly.
- **NO THROWING EXCEPTIONS for control flow.** Return `Result<T,E>` via a discriminated union. Panics are bugs.
- **NO REGEX on structured data.** Git porcelain output is parsed via NUL-delimited splits (`-z` flag everywhere). Never regex over JSON, YAML, source code, or git output.
- **NO PLACEHOLDERS.** If something isn't implemented, leave a loud compilation error with TODO. Silent no-ops = ⛔️ ILLEGAL.
- **DATA MODELS — generate with typeDiagram, NEVER by hand.** Define every data model (types, DTOs, entities, enums, ADTs) in [typeDiagram](https://typediagram.dev/docs/) and generate the TypeScript from it. The model is the source of truth; the build pipeline regenerates the types via typeDiagram codegen — never edit generated files, never hand-craft a model. If typeDiagram can't express your case, file an issue on its repo instead of hand-rolling, and reference that issue at the narrowest possible temporary shim. Spec: REPO-STANDARDS-SPEC [MODEL-TYPEDIAGRAM].
- **Functions < 20 lines.** Refactor aggressively.
- **Files < 450 lines.** Extract modules when over.
- **ZERO DUPLICATION.** Search before writing. Move code, don't copy. Diffr detects diffs — its own codebase must be exemplary.
- **TypeScript strict mode.** `tsconfig.json` has `"strict": true`. No `any` (use `unknown` and narrow). No `!` (non-null assertion) — use optional chaining or explicit guards. No `// @ts-ignore` / `@ts-nocheck`. No `as Type` casts without a comment explaining safety. All function params and return types annotated.
- **No suppressing linter warnings.** Fix the code, not the linter.
- **Decouple providers from the VSCode SDK.** `src/git/` and `src/ui/uri.ts` have ZERO `vscode` imports. SDK-bound modules are thin shells around pure logic.
- **No string literals.** Named constants only, all in `src/constants.ts`.
- **Named parameters** for functions with 3+ args.
- **No commented-out code.** Delete it.
- **No legacy code.** Legacy = deleted.
- **Copying files is illegal.** MOVE them.
- **Centralize global state** in `src/state.ts`.
- **Auto-memory is OFF.** Persistent rules go through a reviewed PR to this file — never auto-captured memory. (Claude Code: `"autoMemoryEnabled": false` in committed `.claude/settings.local.json`.)
- **Spec IDs are hierarchical, non-numeric: `[GROUP-TOPIC]` / `[GROUP-TOPIC-DETAIL]`** (e.g. `[GIT-PARSE-PORCELAIN]`, `[UI-FILEPICKER]`). Same-group sections sit adjacent in the spec's TOC. NO sequential numbers (`[SPEC-001]`). Code, tests, and docs implementing a spec section MUST reference its ID in a comment so `grep '\[GIT-'` finds spec → code → tests in one shot.

## Git Discipline

**Default to NOT touching git at all.** Diffr itself shells out to `git` at runtime — that's the product. The _agent_ doesn't drive git in the dev loop. CI and GitHub Actions do the git work. Use git only when the user has explicitly green-lit it for the task. The rules below govern those green-lit cases:

- **NEVER push to the default branch (`main`) directly.** Always PR → CI green → merge. No exceptions.
- **Once you open a PR, OWN it until it's green.** Enable auto-merge where allowed (`gh pr merge --auto --squash`) so it lands when checks pass — then keep monitoring: on a failure, pull the logs, fix it, push, and loop until every required check passes. Never hand back a red or still-running PR.
- **NEVER list yourself as a commit co-author.** No `Co-Authored-By` trailer, no agent attribution. This one is never overridable.
- **Work on exactly ONE branch at a time, always** — even with multiple agents working concurrently. They share the single branch and coordinate through the Too Many Cooks server; they never cut their own.
- **NEVER start a new branch when a feature branch already exists.** Check first; work on the open one.
- **If multiple feature branches exist, merge them into one IMMEDIATELY before doing any other work.**
- **Worktrees are forbidden by default.** Never run `git worktree` unless the user explicitly demands it — agents consistently corrupt their state with it.

### Branch naming

| Type         | Pattern                   | Example                  |
| ------------ | ------------------------- | ------------------------ |
| Feature      | `feature/[ISSUE]-[slug]`  | `feature/42-file-picker` |
| Bug fix      | `fix/[ISSUE]-[slug]`      | `fix/17-null-ref`        |
| Chore        | `chore/[slug]`            | `chore/update-deps`      |
| Release      | `release/[semver]`        | `release/1.2.0`          |
| Claude agent | `claude/[slug]-[random5]` | `claude/refactor-XYZab`  |

All changes ship via PR. CI must pass before merge. Squash-merge only. Delete the branch after merge.

## Logging Standards

- **`pino` only.** Never `console.log` for diagnostics.
- **Log at entry/exit of significant operations.** Levels: `error|warn|info|debug|trace`. Silent failures are forbidden.
- **Structured fields, not string interpolation.** `logger.info({ rev, path }, 'show')` — never format strings.
- Write detailed logs to a file in the extension's state folder. Basic errors AND diagnostics MUST also appear in the extension's VSCode Output Channel so users can see them without hunting for files.
- **NEVER log file contents, repo paths containing user data, commit messages, branch names, or secrets.** Log SHAs (already opaque) and counts.

## Testing Rules

- **Testing any UI/Extension with a fake VSCode = ⛔️ ILLEGAL.** Tests run in actual VSCode via `@vscode/test-electron`.
- **`make test` is FAIL-FAST.** Stops at first failure. Never `--no-fail-fast`.
- **`make test` ALWAYS computes coverage AND enforces it.** Threshold lives in `coverage-thresholds.json` at the repo root — NOT env vars, NOT GH repo variables, NOT CI YAML. Below threshold = pipeline fails. Ratchet only.
- **`make test` exercises the SHIPPED VSIX.** The e2e target runs the one packaging recipe the release ships, then tests the staged artifact. A green run against a different bundle than users install is worthless. Never add a separate "test build".
- **Aim for 100% coverage.** LOTS OF ASSERTIONS PER TEST.
- **Never delete a failing test. Never skip a test.** Never remove assertions. Reducing assertiveness = ⛔️ ILLEGAL.
- **Meaningful assertions only.** `assert.ok(true)` is illegal.
- **No try/catch in tests that swallows errors and asserts success.**
- **Deterministic.** No `sleep`, no timing dependencies, no random state.
- **E2E tests: black-box only.** Drive the extension through `vscode.commands.executeCommand`, real VSCode UI surfaces, and assertions against `vscode.window.tabGroups.all`. Never call provider methods directly. Never call `provider.refresh()`. Never reach into internal state. Never invoke commands that should only fire from user gestures.
- **NEVER KILL VSCODE PROCESSES.**
- Separate E2E (`src/test/suite/`) from unit (`src/test/unit/`) by directory.
- Unit tests = no VSCode instance needed = isolation only (parsers, URI codec, Result combinators).
- Tests must prove **user interactions** work end-to-end.
- E2E tests should bundle **many user interactions and loads of assertions** per file — prefer extending an existing test over adding a new one.
- **FAILING TEST = OK. TEST THAT DOESN'T ENFORCE BEHAVIOR = ⛔️ ILLEGAL.**

### Test-First Process

1. Write a test that fails because of the bug / missing feature.
2. Run tests; verify the failure is for that reason.
3. Adjust until the failure mode matches.
4. Implement the fix / feature.
5. Run tests; verify the test passes without modification.

### Assertion style (human-readable)

Do not write assertions that guard against AI / taxonomy strings. Assert on **positive, human-readable values** that the user would actually see.

⛔️ BAD

```typescript
assert.doesNotMatch(label, /\[diffr-internal-tag\]/);
```

✅ GOOD

```typescript
const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
const diffTab = tabs.find((t) => t.input instanceof vscode.TabInputTextDiff);
assert.ok(diffTab, "a diff tab opened");
assert.match(diffTab.label, /a1b2c3 ↔ Working Copy/);
```

## Human vs. AI Readability

Two audiences. Write for the right one.

- **Code comments:** humans first, AI second. Only when the WHY is non-obvious.
- **UI (QuickPick labels, diff titles, OutputChannel):** humans. Always. Include a "Copy Context For AI" menu item where context-sharing is genuinely useful.
- **Diff titles** must be human-scannable: `${shortShaA} ↔ ${shortShaB} — ${basename}` or `${shortSha} ↔ Working Copy — ${basename}`. No internal labels, no enum names, no debug strings.

## Repo Structure

```
Diffr/
├── .github/
│   ├── SECURITY.md
│   ├── copilot-instructions.md      # pointer → AGENTS.md
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   └── workflows/{ci.yml, codeql.yml, dependabot-automerge.yml, release.yml}
├── .vscode-test.mjs
├── Makefile                       # standard targets + repo-specific section
├── package.json                   # extension manifest
├── shipwright.json                # release manifest (Shipwright)
├── tsconfig.json                  # strict: true
├── eslint.config.mjs
├── .prettierrc.json
├── coverage-thresholds.json       # single source of truth for coverage
├── icon.png
├── README.md
├── CHANGELOG.md
├── AGENTS.md                      # this file — canonical agent instructions
├── docs/
│   ├── design-system.md
│   ├── plans/plan.md
│   └── specs/spec.md              # full design + execution plan
├── scripts/                       # build/release tooling (.mjs)
├── src/
│   ├── extension.ts               # activate/deactivate; registration ONLY
│   ├── constants.ts               # command IDs, scheme name, context keys
│   ├── result.ts                  # Result<T,E>
│   ├── logger.ts                  # pino + OutputChannel sink
│   ├── state.ts                   # Memento wrapper (single global-state file)
│   ├── menus.ts                   # package.json menu contributions, generated
│   ├── vscodeGitApi.ts            # vscode.git extension API shim
│   ├── git/                       # ZERO vscode imports
│   │   ├── GitRunner.ts
│   │   ├── GitRepo.ts
│   │   ├── parsers.ts             # NUL-delimited porcelain parsers
│   │   ├── repoMatch.ts
│   │   └── types.ts
│   ├── providers/
│   │   └── DiffrContentProvider.ts
│   ├── ui/
│   │   ├── CommitPicker.ts
│   │   ├── RefPicker.ts
│   │   ├── SideBPicker.ts
│   │   ├── runQuickPick.ts
│   │   ├── cancelled.ts
│   │   ├── format/
│   │   └── uri.ts                 # pure; ZERO vscode imports
│   ├── commands/                  # one file per command; glue only
│   └── test/
│       ├── unit/                  # mocha, no VSCode
│       └── suite/                 # @vscode/test-electron, black-box only
└── test-fixtures/
    └── repo-seed/                 # script-built throwaway git repo for E2E
```

## Too Many Cooks (Multi-Agent Coordination)

If the TMC server is available: register on start (name, intent, files), lock files before editing, broadcast your plan and message others frequently, check messages periodically, release locks when done. Never edit a locked file — wait or take another approach.

## VSCode SDK References

- [VSCode Extension API](https://code.visualstudio.com/api/)
- [VSCode Extension Testing API](https://code.visualstudio.com/api/extension-guides/testing)
- [Built-in `vscode.diff` command](https://code.visualstudio.com/api/references/commands)
- [Git Extension API (`vscode.git`)](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts)
