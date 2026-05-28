---
name: upgrade-packages
description: Upgrade all dependencies/packages to their latest versions. Diffr is TypeScript/Node — use when the user says "upgrade packages", "update dependencies", "bump versions", "update packages", or "upgrade deps".
argument-hint: "[--check-only] [--major] [package-name]"
---
<!-- agent-pmo:74cf183 -->

# Upgrade Packages

Upgrade Diffr's npm dependencies to their latest compatible (or latest major, if `--major`) versions.

## Arguments

- `--check-only` — List outdated packages without upgrading. Stop after Step 2.
- `--major` — Include major version bumps (breaking changes). Without this flag, stay within semver-compatible ranges.
- Any other argument is treated as a specific package name to upgrade (instead of all packages).

## Step 1 — Detect package manager

Diffr uses **npm** (package manifest: `package.json`, lockfile: `package-lock.json`). If for some reason the repo has migrated to yarn or pnpm, adapt accordingly (`yarn outdated`/`yarn up` or `pnpm outdated`/`pnpm update`).

If `package.json` is missing, stop and tell the user.

## Step 2 — List outdated packages

Run BEFORE upgrading anything. Show the user what will change.

```bash
npm outdated
```

**Read the docs:** https://docs.npmjs.com/cli/v10/commands/npm-update

If `--check-only` was passed, **stop here** and report the outdated list.

## Step 3 — Read the official upgrade docs

**Before running any upgrade command, you MUST fetch and read the official documentation URL above.** Use WebFetch to retrieve the page. This ensures you use the correct flags and understand the behavior. Do not guess at flags or options from memory.

## Step 4 — Upgrade packages

Run the upgrade. If a specific package name was given as an argument, upgrade only that package.

```bash
npm update                            # semver-compatible (within package.json ranges)
# --major flag:
npx npm-check-updates -u && npm install   # bump package.json to latest majors
```

### Diffr-specific cautions

- `@types/vscode` and `@types/node` must remain compatible with the `engines.vscode` minimum declared in `package.json`. A major bump that requires a newer VSCode runtime is a breaking change to consumers.
- `@vscode/test-electron`, `mocha`, `c8`, and `vsce` (`@vscode/vsce`) are tightly coupled to the extension test/release pipeline — review their changelogs before bumping.
- `typescript`, `eslint`, `typescript-eslint`, `prettier` — major bumps frequently change rule defaults; rerun `make lint` and `make fmt CHECK=1` after the upgrade.

## Step 5 — Verify the upgrade

After upgrading, run the project's build and test suite to confirm nothing broke:

```bash
make ci
```

If tests fail:
1. Read the failure output carefully
2. Check the changelog / migration guide for the upgraded packages (fetch the release notes URL if available)
3. Fix breaking changes in the code
4. Re-run tests
5. If stuck after 3 attempts on the same failure, report it to the user with the error details and the package that caused it

## Step 6 — Report

Provide a summary:

- Packages upgraded (old version -> new version)
- Packages skipped (and why, e.g., major version bump without `--major` flag)
- Build/test result after upgrade
- Any breaking changes that were fixed
- Any packages that could not be upgraded (with error details)

## Rules

- **Always list outdated packages first** before upgrading anything
- **Always read the official docs** for the package manager before running upgrade commands
- **Always run `make ci` after upgrading** to catch breakage immediately
- **Never remove packages** unless they were explicitly deprecated and replaced
- **Never downgrade packages** unless rolling back a broken upgrade
- **Never modify `package-lock.json` manually** — let npm regenerate it
- **Commit nothing** — leave changes in the working tree for the user to review

## Success criteria

- All outdated packages upgraded to latest compatible (or latest major if `--major`)
- `make ci` passes
- User has a clear summary of what changed
