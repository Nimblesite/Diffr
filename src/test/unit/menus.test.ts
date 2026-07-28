import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMAND_IDS, MENU_IDS, MENU_WHEN, TITLE_PREFIX } from "../../constants";
import { COMMAND_TITLES, buildMenuManifest } from "../../menus";

const PROPOSED_API_HISTORY_ITEM_MENU = "contribSourceControlHistoryItemMenu";

const repoRoot = resolve(__dirname, "..", "..", "..");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`package.json: ${what} missing`);
  }
  return value;
};

const readPackageJson = (): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return requireRecord(parsed, "root object");
};

const getContributes = (pkg: Record<string, unknown>): Record<string, unknown> =>
  requireRecord(pkg["contributes"], "contributes");

const getMenus = (contributes: Record<string, unknown>): Record<string, unknown> =>
  requireRecord(contributes["menus"], "contributes.menus");

const titlePrefixPattern = new RegExp(`^${TITLE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `);

describe("menu manifest — single source of truth", () => {
  it("every COMMAND_ID has a human title in COMMAND_TITLES", () => {
    for (const id of Object.values(COMMAND_IDS)) {
      const title = COMMAND_TITLES[id];
      assert.ok(title !== undefined, `missing title for command ${id}`);
      assert.match(title, titlePrefixPattern, `title for ${id} must start with "${TITLE_PREFIX} "`);
    }
  });

  it("manifest contributes commands to the four user-discoverable menus", () => {
    const manifest = buildMenuManifest();
    const menuIds = Object.keys(manifest.menus);
    assert.deepEqual(
      menuIds.sort(),
      [
        MENU_IDS.editorTitleContext,
        MENU_IDS.explorerContext,
        MENU_IDS.scmHistoryItem,
        MENU_IDS.scmResourceState,
      ].sort(),
      "menu IDs must match VSCode contribution points (note: singular scm/historyItem/context)"
    );
  });

  it("SCM history item menu contains all five commit-level Diffr commands", () => {
    const entries = buildMenuManifest().menus[MENU_IDS.scmHistoryItem];
    assert.ok(entries !== undefined);
    const cmds = entries.map((e) => e.command);
    assert.deepEqual(cmds, [
      COMMAND_IDS.compareWith,
      COMMAND_IDS.compareWithWorkingCopy,
      COMMAND_IDS.compareWithPrevious,
      COMMAND_IDS.compareWithBranch,
      COMMAND_IDS.compareWithTag,
    ]);
    for (const e of entries) {
      assert.equal(e.when, MENU_WHEN.scmGit);
      assert.match(e.group, /^diffr@\d+$/);
    }
  });

  it("editor/title/context and explorer/context and scm/resourceState/context all expose the three file-level Diffr commands", () => {
    const m = buildMenuManifest().menus;
    const fileLevel = [
      COMMAND_IDS.compareFileWithCommit,
      COMMAND_IDS.compareFileWithBranch,
      COMMAND_IDS.compareFileWithTag,
    ];
    for (const menuId of [MENU_IDS.editorTitleContext, MENU_IDS.explorerContext, MENU_IDS.scmResourceState]) {
      const entries = m[menuId];
      assert.ok(entries !== undefined, `missing ${menuId}`);
      assert.deepEqual(
        entries.map((e) => e.command),
        fileLevel,
        `${menuId} must list the three file-level commands in order`
      );
    }
  });

  // The SCM graph commit menu is proposal-gated and published extensions never receive it,
  // so hiding these from the palette left them unreachable for every Marketplace user.
  it("commit-level commands stay reachable from the Command Palette", () => {
    const palette = buildMenuManifest().commandPalette;
    const hidden = palette.map((e) => e.command);
    for (const cmd of [
      COMMAND_IDS.compareWith,
      COMMAND_IDS.compareWithWorkingCopy,
      COMMAND_IDS.compareWithPrevious,
      COMMAND_IDS.compareWithBranch,
      COMMAND_IDS.compareWithTag,
    ]) {
      assert.ok(!hidden.includes(cmd), `${cmd} must NOT be hidden — the palette is its only real surface`);
    }
    assert.deepEqual(hidden, [COMMAND_IDS.showLogs], "only showLogs is hidden from the palette");
    for (const e of palette) {
      assert.equal(e.when, MENU_WHEN.never);
    }
  });

  it("package.json contributes.menus is byte-equal to what the manifest would write", () => {
    const manifest = buildMenuManifest();
    const pkg = readPackageJson();
    const contributes = getContributes(pkg);
    const pkgMenus = getMenus(contributes);

    for (const [menuId, entries] of Object.entries(manifest.menus)) {
      const written = pkgMenus[menuId];
      assert.deepEqual(
        written,
        entries.map((e) => ({
          command: e.command,
          when: e.when,
          group: e.group,
        })),
        `package.json ${menuId} drifted from src/menus.ts — run 'npm run sync:menus'`
      );
    }

    assert.deepEqual(
      pkgMenus[MENU_IDS.commandPalette],
      manifest.commandPalette.map((e) => ({ command: e.command, when: e.when })),
      "package.json commandPalette block drifted from src/menus.ts"
    );
  });

  it("package.json contributes.commands lists every COMMAND_TITLES entry exactly", () => {
    const pkg = readPackageJson();
    const contributes = getContributes(pkg);
    const cmds = contributes["commands"];
    assert.ok(Array.isArray(cmds), "package.json contributes.commands is an array");

    const expected = Object.entries(COMMAND_TITLES).map(([command, title]) => ({
      command,
      title,
    }));
    assert.deepEqual(cmds, expected, "package.json commands drifted — run npm run sync:menus");
  });

  // Stable VSCode grants this proposal only to built-in and allowlisted extensions, so the
  // commit-row menu appears in dev hosts and under --enable-proposed-api but NEVER for a
  // Marketplace install. The declaration is kept for those hosts; the palette is the surface
  // real users get, which the "commit-level commands stay reachable" test above guards.
  it("package.json declares contribSourceControlHistoryItemMenu (lights up the commit menu in dev hosts only)", () => {
    const pkg = readPackageJson();
    const proposals = pkg["enabledApiProposals"];
    assert.ok(Array.isArray(proposals), "package.json must declare enabledApiProposals");
    assert.ok(
      (proposals as readonly string[]).includes(PROPOSED_API_HISTORY_ITEM_MENU),
      `enabledApiProposals must include ${PROPOSED_API_HISTORY_ITEM_MENU}`
    );
  });
});
