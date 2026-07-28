---
name: code-dedup
description: Searches for duplicate code, duplicate tests, and dead code, then safely merges or removes them. Use when the user says "deduplicate", "find duplicates", "remove dead code", "DRY up", or "code dedup". Requires test coverage — refuses to touch untested code.
---
<!-- agent-pmo:a72c926 -->

# Code Dedup

Find duplicate code, duplicate tests, and dead code across Diffr. Merge duplicates and delete dead code — but only when test coverage proves the change is safe.

## Prerequisites — hard gate

Stop and report if any of these fail:

1. **Tests green.** Run `make test` — it packages and verifies the shipped VSIX, then runs fail-fast and enforces the coverage threshold from `coverage-thresholds.json` (REPO-STANDARDS-SPEC [TEST-RULES]). Non-zero exit = stop. Never dedup a broken or under-covered codebase. Note the current coverage % — it is the floor and must not drop.
2. **Static typing.** `tsconfig.json` must have `"strict": true`. Confirm it before touching anything — dedup without types is too risky.

## Scanner — no structural scanner available for TypeScript

**deslop does not support TypeScript** (its languages are `csharp`, `rust`, `python`, `dart` — see https://deslop.live/docs/for-ai/). Diffr is pure TypeScript, so there is **no structural duplicate scanner here**.

Say this up front, label every finding `(no-deslop fallback)`, and never pretend a structural scan ran. The fallback toolkit is:

- **`npm run typecheck`** (`tsc -p . --noEmit`) — surfaces unused locals/parameters via the strict compiler options.
- **`npm run lint`** (`eslint src`) — the analyzer output flags unreachable and unused code.
- **Symbol-level grep.** For each exported symbol, `grep -rn "<symbol>" src/ scripts/` across the whole repo including tests, scripts, and `package.json` contributions.
- **`src/menus.ts` / `scripts/sync-menus.mjs`** — command and menu contributions are generated. A command that looks unreferenced in `src/` may still be wired through `package.json`. Always check both before calling anything dead.

**Rule:** every duplicate you act on must be cited in the final report by file:line for each occurrence, with the reason it is a true duplicate. No anonymous "found some duplicates".

## Steps

```
Dedup Progress:
- [ ] Step 1: Prerequisites passed (tests green, coverage noted, strict typing confirmed)
- [ ] Step 2: Dead code scan complete
- [ ] Step 3: Duplicate code scan complete
- [ ] Step 4: Duplicate test scan complete
- [ ] Step 5: Changes applied — one at a time, each verified
- [ ] Step 6: Verification passed (tests green, coverage stable)
```

### Step 1 — Inventory coverage
Confirm the green baseline from the prerequisites. Only files WITH coverage are candidates — leave untested files alone.

### Step 2 — Scan for dead code
Find code never called, imported, or referenced. Use the compiler's own signal first: `npm run typecheck` for unused locals and parameters, `npm run lint` analyzer output. For each candidate, grep the whole codebase (`src/`, `src/test/`, `scripts/`, `package.json`, `.vscode-test.mjs`) — only dead if truly zero references. Remember that command IDs in `src/constants.ts` are referenced from `package.json` contributions, not just from TypeScript. List candidates with file:line. Do NOT delete yet.

### Step 3 — Scan for duplicate code
1. Work module by module through the architecture layers: `src/git/`, `src/ui/`, `src/commands/`, `src/providers/`. Duplication clusters most often in `src/commands/` (one file per command, all glue) and `src/ui/format/`.
2. For each candidate pair, read every occurrence in full. Structure that merely rhymes is not duplication — if two command handlers differ on a subtle condition, default, or error path, leave them and note "false positive".
3. Record `{ occurrences[], decision, rationale }`. Do NOT merge yet.

### Step 4 — Scan for duplicate tests
Same as Step 3, restricted to `src/test/unit/` and `src/test/suite/`. Keep the more thorough test — per AGENTS.md the E2E test that drives real VS Code surfaces wins over a narrower unit test. Flag shared test fixtures/helpers as merge candidates rather than deletions. **Never** reduce the number of assertions.

### Step 5 — Apply changes (one at a time)
Cycle per change: **change → `make test` → check coverage → continue or revert.**

**5a. Dead code:** delete, then `make test`. Non-zero exit = revert.

**5b. Merge duplicate code:** pick ONE cluster. Extract shared logic (respecting the layer rules in AGENTS.md — `src/git/` and `src/ui/uri.ts` must keep ZERO `vscode` imports), update call sites, `make test`. Tests fail = revert (subtle semantic difference). Coverage drops = add tests first.

**5c. Duplicate tests:** delete the redundant test (keep the thorough one), `make test`. Coverage drop = revert (it covered something the other didn't).

### Step 6 — Final verification
1. `make lint` — ESLint, `tsc --noEmit`, and the shipwright.json schema check all pass.
2. `make test` — green AND coverage ≥ the Step 1 floor.
3. Report: every occurrence acted on (file:line, merged/deleted), and final coverage vs baseline.

## Rules

- **No structural scanner exists for TypeScript.** Declare the `(no-deslop fallback)` mode up front; best-effort scan via compiler, linter, and symbol grep.
- **No coverage = do not touch.** You cannot safely dedup what you cannot verify.
- **Coverage must not drop.** The Step 1 floor is sacred — revert anything that lowers it.
- **One change at a time.** Never batch dedup changes before testing.
- **When in doubt, leave it.** False dedup is worse than duplication.
- **Preserve public API.** Internal refactoring only — no changes to command IDs, the `diffr://` URI shape, or anything `package.json` contributes.
- **Respect the layer boundaries.** Never introduce a `vscode` import into `src/git/` or `src/ui/uri.ts` in the name of sharing code.
- **Trivial duplication is fine.** Only dedup substantial shared logic (>10 lines) or 3+ copies.
