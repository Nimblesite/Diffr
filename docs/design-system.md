# Diffr Design System

This design system defines the visual and content standards for the future Diffr website, documentation pages, marketplace graphics, release notes, and adjacent product collateral.

It does not define in-extension UI. Diffr remains a native VS Code extension that uses context menus, Command Palette entries, QuickPick, OutputChannel, and `vscode.diff`.

## Product Position

Diffr is a developer tool for comparing two git states without leaving the workflow the developer already uses.

Core promise:

> Pick two things and diff them.

Design principles:

- **Native first:** Present Diffr as a small, precise addition to VS Code, not a replacement shell.
- **Fast orientation:** Help developers understand entry points, command scope, and resulting diffs quickly.
- **Quiet confidence:** Use restrained visual emphasis, clear hierarchy, and practical examples.
- **Diff literacy:** Visual language should make "left vs right", changed files, additions, removals, and revisions immediately legible.
- **No novelty tax:** Avoid playful abstractions when a direct git, file, or VS Code concept would be clearer.

Audience:

- Developers reviewing commits, branches, staged work, and working-copy changes.
- Maintainers who need a lightweight extension with no custom panels or persistent UI.
- Teams evaluating the extension from the marketplace, README, or project website.

## Brand Voice

Diffr's voice is direct, concise, and work-focused.

Use:

- Short verbs: pick, compare, open, reopen, review.
- Concrete nouns: commit, branch, tag, index, working copy, file.
- Plain explanations of scope and constraints.
- Human-readable examples such as `a1b2c3d -> Working Copy - src/foo.ts`.

Avoid:

- Marketing claims that imply AI, automation, or code review intelligence.
- Heavy productivity language such as "10x", "revolutionary", or "magic".
- Internal implementation labels in user-facing copy.
- Explaining VS Code basics unless the page is explicitly instructional.

Example headlines:

- "Pick two git states and open the diff."
- "Context-menu diffing for VS Code."
- "Compare commits, branches, tags, the index, and your working copy."

Example body copy:

> Diffr adds focused compare commands to the VS Code surfaces you already use: SCM history, SCM changes, editor tabs, Explorer, and the Command Palette.

## Logo Direction

The Diffr mark should communicate comparison, pairing, and code review without looking like a separate IDE.

The current logo set is raster-only. There is no SVG source for these assets. Each icon is built from flat geometric shapes, hard color boundaries, and no text, so a future vector conversion can trace the shapes cleanly.

The whole set is rendered from the same primary mark — there are no alternate concepts in the current shipping set. Pick the size closest to the target rendering surface; the root `icon.png` is byte-identical to the 128 px export.

Current assets:

| Asset                                              | Format | Use                          |
| -------------------------------------------------- | ------ | ---------------------------- |
| [Primary 128](assets/diffr-icon-primary-128.png)   | PNG    | Root extension icon source   |
| [Primary 256](assets/diffr-icon-primary-256.png)   | PNG    | Marketplace and docs         |
| [Primary 512](assets/diffr-icon-primary-512.png)   | PNG    | High-resolution export       |
| [Primary 1024](assets/diffr-icon-primary-1024.png) | PNG    | Print, hero, and zoom assets |
| [Primary WebP](assets/diffr-icon-primary.webp)     | WebP   | Compressed website asset     |
| Root extension icon: `icon.png`                    | PNG    | VS Code package icon         |

Preferred concepts:

- Opposing panes, brackets, or angled halves that imply Side A vs Side B.
- A clear central gutter or compare rail.
- Flat shapes with enough negative space to survive at 16px.
- One primary brand accent plus optional semantic diff accents.

Do:

- Keep icons readable at 16px, 32px, 128px, and 256px.
- Use flat fills, crisp geometry, and limited color counts.
- Test against light, dark, and marketplace backgrounds.
- Keep icon variants text-free.

Do not:

- Use VS Code product marks or GitHub marks as part of the logo.
- Build the mark around a custom sidebar, panel, activity icon, or webview concept.
- Use gradients, shadows, texture, tiny line art, or photo-like detail in extension icons.

## Color

The palette balances a neutral developer-tool foundation with semantic diff colors. Blue is used as the primary action color, but the system should not become a single-hue blue interface.

### Core Palette

| Token        | Hex       | Use                                  |
| ------------ | --------- | ------------------------------------ |
| `ink.950`    | `#14161a` | Primary text, dark UI foundation     |
| `ink.800`    | `#272c33` | Secondary text on light surfaces     |
| `ink.600`    | `#5b6470` | Muted text, metadata                 |
| `ink.300`    | `#b8c0ca` | Borders on dark surfaces             |
| `ink.100`    | `#e6e9ee` | Borders on light surfaces            |
| `paper.000`  | `#ffffff` | Primary page surface                 |
| `paper.050`  | `#f7f8fa` | Alternate section background         |
| `paper.100`  | `#eef1f5` | Code-block and table backgrounds     |
| `blue.600`   | `#2563eb` | Primary links and actions            |
| `blue.700`   | `#1d4ed8` | Action hover state                   |
| `cyan.500`   | `#0891b2` | Secondary accent, command highlights |
| `green.600`  | `#16a34a` | Additions, success                   |
| `red.600`    | `#dc2626` | Deletions, errors                    |
| `amber.500`  | `#d97706` | Warnings, changed-state emphasis     |
| `violet.600` | `#7c3aed` | Rare accent for branch/tag callouts  |

### Semantic Tokens

| Token            | Hex       | Use                               |
| ---------------- | --------- | --------------------------------- |
| `text.primary`   | `#14161a` | Default body text                 |
| `text.secondary` | `#5b6470` | Metadata and helper text          |
| `surface.page`   | `#ffffff` | Page background                   |
| `surface.subtle` | `#f7f8fa` | Alternating content bands         |
| `surface.code`   | `#eef1f5` | Inline code and examples          |
| `border.default` | `#e6e9ee` | Default border                    |
| `action.primary` | `#2563eb` | Primary buttons and links         |
| `diff.addition`  | `#16a34a` | Added lines and `+N` indicators   |
| `diff.deletion`  | `#dc2626` | Deleted lines and `-N` indicators |
| `diff.modified`  | `#d97706` | Modified files                    |
| `diff.rename`    | `#0891b2` | Renamed or copied files           |

### Usage Rules

- Body surfaces should stay mostly white or near-white.
- Use dark surfaces sparingly for code, terminal-style examples, or first-viewport contrast.
- Use green and red only when the meaning is addition/deletion, pass/fail, or success/error.
- Never rely on color alone for diff status. Pair color with text, symbols, or position.
- Maintain WCAG AA contrast for text and interactive states.

## Typography

### Font Stack

Website UI:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Code, command IDs, SHAs, file paths:

```css
font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

### Type Scale

| Role    | Size | Line height | Weight | Use                            |
| ------- | ---: | ----------: | -----: | ------------------------------ |
| Display | 48px |        56px |    700 | Homepage H1 only               |
| H1      | 40px |        48px |    700 | Major page title               |
| H2      | 30px |        38px |    650 | Major sections                 |
| H3      | 22px |        30px |    650 | Subsections and feature groups |
| Body    | 16px |        26px |    400 | Default reading text           |
| Small   | 14px |        22px |    400 | Metadata and helper text       |
| Code    | 14px |        22px |    500 | Paths, command IDs, examples   |
| Caption | 12px |        18px |    500 | Labels, badges, status chips   |

Rules:

- Do not scale type with viewport width.
- Use `letter-spacing: 0`.
- Keep display type for true hero areas only.
- Keep docs content readable with a maximum line length near 72 characters.

## Layout

### Page Widths

| Token               |    Value | Use                                  |
| ------------------- | -------: | ------------------------------------ |
| `container.reading` |  `760px` | Docs, changelog, long-form content   |
| `container.content` | `1120px` | Marketing sections and feature grids |
| `container.wide`    | `1280px` | Screenshots, comparison diagrams     |
| `gutter.mobile`     |   `20px` | Mobile horizontal padding            |
| `gutter.desktop`    |   `32px` | Desktop horizontal padding           |

### Spacing Scale

Use an 8px spacing base.

| Token     |  Value |
| --------- | -----: |
| `space.1` |  `4px` |
| `space.2` |  `8px` |
| `space.3` | `12px` |
| `space.4` | `16px` |
| `space.5` | `24px` |
| `space.6` | `32px` |
| `space.7` | `48px` |
| `space.8` | `64px` |
| `space.9` | `96px` |

### Layout Rules

- Use full-width page bands with constrained inner content.
- Do not put page sections inside floating cards.
- Cards are for repeated items, command references, release entries, and framed examples.
- Keep card radius at `8px` or less.
- Every fixed-format UI mock should have stable dimensions to prevent layout shift.
- On the homepage, the first viewport should show the product name, the promise, a real product-oriented visual, and a hint of the next section.

## Imagery

Website imagery should show the actual developer workflow.

Preferred assets:

- Clean screenshots of VS Code SCM history context menus with Diffr commands.
- File QuickPick screenshots showing changed files and stats.
- `vscode.diff` screenshots with readable left/right labels.
- Simple diagrams showing Side A, Side B, and file selection flow.
- Marketplace graphics that pair the Diffr mark with a real diff or command surface.

Avoid:

- Abstract gradient backgrounds without product context.
- Decorative code rain, fake dashboards, or invented web app panels.
- Blurred screenshots that hide the actual command labels.
- Cropped imagery where the user cannot identify VS Code, SCM history, QuickPick, or diff tabs.

Screenshot treatment:

- Use native VS Code themes for product screenshots.
- Prefer a light VS Code screenshot on a white or subtle surface.
- Provide dark-theme variants only when needed.
- Annotate sparingly with small numbered callouts or simple labels.

## Icons

Use a consistent outline icon set for the website, such as Lucide, when building the web UI.

Recommended icon mappings:

| Concept       | Icon                  |
| ------------- | --------------------- |
| Compare       | `GitCompare`          |
| Commit        | `GitCommitHorizontal` |
| Branch        | `GitBranch`           |
| Tag           | `Tag`                 |
| File          | `FileText`            |
| Working copy  | `FolderGit2`          |
| Index/staging | `ListChecks`          |
| Reopen        | `History`             |
| Logs          | `ScrollText`          |
| External link | `ExternalLink`        |

Rules:

- Icons support recognition; they do not replace precise labels for commands.
- Icon buttons need accessible names and hover tooltips.
- Keep icon stroke width visually aligned with text weight.
- Do not introduce custom symbols for standard git concepts when a common icon exists.

## Components

### Header

Purpose:

- Orient users.
- Provide links to docs, GitHub, marketplace, releases, and install instructions.

Structure:

- Left: Diffr mark and wordmark.
- Center or right: Docs, GitHub, Releases.
- Right: primary install action.

Behavior:

- Header should be compact and sticky only on docs pages.
- On mobile, collapse links into a menu with clear labels.

### Hero

Purpose:

- State what Diffr does and show it in context.

Required content:

- H1: `Diffr`.
- Supporting copy that includes "Pick two things and diff them."
- Primary action: install or marketplace link.
- Secondary action: view docs or GitHub.
- Product visual: screenshot or interaction mock of context-menu -> QuickPick -> diff.

Rules:

- Do not put the hero text in a card.
- Avoid split layouts where the screenshot is an ornamental side panel.
- The hero should leave a hint of the next section visible on common desktop and mobile viewports.

### Command Matrix

Purpose:

- Make every entry point scannable.

Fields:

- Surface: SCM history, SCM changes, editor tab, Explorer, Command Palette.
- Command label.
- Side A.
- Side B.
- Result.

Example:

| Surface     | Command                         | Side A        | Side B                                      | Result                 |
| ----------- | ------------------------------- | ------------- | ------------------------------------------- | ---------------------- |
| SCM history | `Diffr: Compare with...`        | Picked commit | Commit, branch, tag, index, or working copy | File picker, then diff |
| Editor tab  | `Diffr: Compare with Commit...` | Picked commit | Current file                                | Single-file diff       |

### Workflow Diagram

Purpose:

- Explain the flow without adding a fake product UI.

Preferred shape:

```text
Choose Side A -> Choose Side B -> Pick changed file -> Open VS Code diff
```

Rules:

- Use real command labels and real git concepts.
- Keep diagrams horizontal on desktop and stacked on mobile.
- Avoid swimlanes unless the page needs implementation depth.

### Feature Cards

Use cards for repeated feature summaries only.

Card anatomy:

- Icon.
- Short title.
- One sentence of body text.
- Optional command label or screenshot thumbnail.

Feature card examples:

- "Context-menu first"
- "Compare against working copy"
- "Review changed files without leaving QuickPick"
- "Reopen the last comparison"

### Code And Command Blocks

Use code blocks for commands, command IDs, and examples.

Rules:

- Keep examples copyable.
- Do not use terminal prompts unless needed.
- Annotate command examples outside the block rather than inside comments.

Example:

```sh
make package
```

### Status And Diff Badges

Use small badges for file states and diff stats.

| Status   | Label | Token           |
| -------- | ----- | --------------- |
| Added    | `A`   | `diff.addition` |
| Modified | `M`   | `diff.modified` |
| Deleted  | `D`   | `diff.deletion` |
| Renamed  | `R`   | `diff.rename`   |
| Copied   | `C`   | `diff.rename`   |

Stats format:

```text
+24 -8
```

Rules:

- Pair `+N` with addition color and `-N` with deletion color.
- Preserve a readable text form for accessibility.
- Keep badges small and stable in width for compact tables.

### Tables

Use tables for command references and capability matrices.

Rules:

- Prefer direct labels over explanatory prose inside cells.
- Use monospace for command IDs, SHAs, and file paths.
- Keep columns narrow enough for mobile wrapping.

### Callouts

Use callouts for important constraints, not decoration.

Types:

- Note: neutral guidance.
- Warning: compatibility, installation, or setup caveats.
- Constraint: product boundaries such as "No panels or webviews."

Constraint callout example:

> Diffr does not add a sidebar, activity-bar icon, tree view, or webview. It uses existing VS Code surfaces.

## Motion

Motion should clarify cause and effect.

Use:

- 120ms to 180ms hover and focus transitions.
- Short reveal animations for diagrams or command flows.
- Reduced-motion fallbacks for all nonessential movement.

Avoid:

- Long looping hero animations.
- Animated backgrounds behind reading text.
- Motion that implies the extension has a custom persistent UI.

## Accessibility

Baseline:

- WCAG 2.2 AA for website pages.
- Keyboard-accessible navigation and controls.
- Visible focus rings on every interactive element.
- Alt text for screenshots that identifies the VS Code surface and command shown.
- Text alternatives for diagrams.
- Color is never the only indicator of diff status.

Focus ring:

```css
outline: 2px solid #2563eb;
outline-offset: 2px;
```

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Content Patterns

### Product One-Liner

Use this where space is limited:

> Context-menu git diffing in VS Code.

### Short Description

Use this for marketplace and social metadata:

> Diffr lets you pick two git states and open file diffs through VS Code's native compare experience.

### Longer Description

Use this for the website intro:

> Diffr adds focused compare commands to VS Code's existing SCM history, SCM changes, editor tab, Explorer, and Command Palette surfaces. Pick a commit, branch, tag, index, or working copy target, then open changed files in VS Code's built-in diff editor.

### SEO Title Pattern

```text
Diffr - Context-menu git diffing for VS Code
```

### Social Description Pattern

```text
Pick two git states and open native VS Code diffs from SCM history, Explorer, editor tabs, or the Command Palette.
```

## Website Information Architecture

Recommended initial website:

- Home: product promise, command flow, install action, screenshots.
- Docs: command reference, workflows, requirements, troubleshooting.
- Changelog: release notes and migration notes.
- Privacy: no telemetry statement for v1 unless this changes.
- GitHub/Marketplace links: external destinations, not duplicated pages.

Homepage section order:

1. Hero with product visual.
2. Command surfaces overview.
3. Side A / Side B comparison flow.
4. Screenshots of real VS Code surfaces.
5. Installation and requirements.
6. Links to docs, changelog, and GitHub.

Docs page groups:

- Getting started.
- Command reference.
- Comparing commits.
- Comparing files.
- Reopening the last comparison.
- Troubleshooting.
- Development links.

## CSS Token Starter

Use these as the first pass for a future web implementation.

```css
:root {
  --diffr-ink-950: #14161a;
  --diffr-ink-800: #272c33;
  --diffr-ink-600: #5b6470;
  --diffr-ink-300: #b8c0ca;
  --diffr-ink-100: #e6e9ee;

  --diffr-paper-000: #ffffff;
  --diffr-paper-050: #f7f8fa;
  --diffr-paper-100: #eef1f5;

  --diffr-blue-600: #2563eb;
  --diffr-blue-700: #1d4ed8;
  --diffr-cyan-500: #0891b2;
  --diffr-green-600: #16a34a;
  --diffr-red-600: #dc2626;
  --diffr-amber-500: #d97706;
  --diffr-violet-600: #7c3aed;

  --diffr-text-primary: var(--diffr-ink-950);
  --diffr-text-secondary: var(--diffr-ink-600);
  --diffr-surface-page: var(--diffr-paper-000);
  --diffr-surface-subtle: var(--diffr-paper-050);
  --diffr-surface-code: var(--diffr-paper-100);
  --diffr-border-default: var(--diffr-ink-100);
  --diffr-action-primary: var(--diffr-blue-600);
  --diffr-action-primary-hover: var(--diffr-blue-700);
  --diffr-diff-addition: var(--diffr-green-600);
  --diffr-diff-deletion: var(--diffr-red-600);
  --diffr-diff-modified: var(--diffr-amber-500);
  --diffr-diff-rename: var(--diffr-cyan-500);

  --diffr-radius-sm: 4px;
  --diffr-radius-md: 8px;
  --diffr-shadow-soft: 0 12px 30px rgb(20 22 26 / 10%);

  --diffr-container-reading: 760px;
  --diffr-container-content: 1120px;
  --diffr-container-wide: 1280px;

  --diffr-space-1: 4px;
  --diffr-space-2: 8px;
  --diffr-space-3: 12px;
  --diffr-space-4: 16px;
  --diffr-space-5: 24px;
  --diffr-space-6: 32px;
  --diffr-space-7: 48px;
  --diffr-space-8: 64px;
  --diffr-space-9: 96px;
}
```

## Governance

Before publishing a new website page or asset, check:

- The page reinforces the core promise: "Pick two things and diff them."
- Product screenshots show real VS Code surfaces.
- The page does not imply a custom panel, sidebar, webview, AI feature, or standalone app.
- Diff colors are semantic and accessible.
- Command labels match the extension manifest and README.
- Installation, requirements, and GitHub links are current.
- Copy stays direct, concise, and developer-facing.
