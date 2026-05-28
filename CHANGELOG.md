# Changelog

All notable changes to **Diffy** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Diffy adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release.

### Added

- **Diffy: Compare with…** (`diffy.compareWith`) on right-click of a commit in
  the SCM History view. Side B is selected from a QuickPick: Working Copy,
  Index, another commit, or a branch/tag.
- **Diffy: Compare with Working Copy** (`diffy.compareWithWorkingCopy`) on
  right-click of a commit. Skips the Side B prompt.
- **Diffy: Compare with Previous** (`diffy.compareWithPrevious`) on right-click
  of a commit. Diffs against the commit's first parent.
- **Diffy: Compare with Commit…** (`diffy.compareFileWithCommit`) on right-click
  of a changed file in SCM Changes, an editor tab, or the File Explorer. Opens a
  single-file diff against the chosen commit.
- **Diffy: Compare Two Commits** (`diffy.compareTwoCommits`) in the Command
  Palette. Full QuickPick chain: repo → Side A commit → Side B → files.
- **Diffy: Reopen Last Comparison** (`diffy.reopenLast`) reopens the file picker
  for the most recent A↔B comparison (stored per workspace).
- **Diffy: Show Logs** (`diffy.showLogs`, hidden from the palette) surfaces the
  Diffy OutputChannel.
- Multi-step QuickPick that stays open after each file is opened, so a single
  comparison can drive many diffs in a row.
- Human-first diff tab titles: `${shortShaA} ↔ ${shortShaB} — ${basename}` or
  `${shortSha} ↔ Working Copy — ${basename}`.
- Structured logging (pino) to a state-folder file and the Diffy OutputChannel.

[0.1.0]: https://github.com/MelbourneDeveloper/Diffy/releases/tag/v0.1.0
