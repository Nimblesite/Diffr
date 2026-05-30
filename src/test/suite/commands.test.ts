import { strict as assert } from "node:assert";
import * as vscode from "vscode";
import { COMMAND_IDS, EXTENSION_ID } from "../../constants";
import {
  type MultiDiffEntry,
  accept,
  allDiffTabs,
  allMultiDiffTabs,
  closeAllEditors,
  dismissQuickPick,
  moveNext,
  multiDiffEntries,
  openFileInEditor,
  readSeedShas,
  scmHistoryArgs,
  tabInputUris,
  tick,
  waitForDiffTab,
  waitForMultiDiffTab,
  waitForRepoReady,
  workspaceRoot,
} from "./helpers";

const ensureActivated = async (): Promise<void> => {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (ext !== undefined && !ext.isActive) {
    await ext.activate();
  }
  await waitForRepoReady();
  await tick(20);
};

const labelStrings = (tab: vscode.Tab): string => tab.label;

const moveAndAccept = async (steps: number): Promise<void> => {
  for (let i = 0; i < steps; i++) {
    await moveNext();
  }
  await accept();
};

const short = (sha: string): string => sha.slice(0, 7);

// Awaits the one persistent multi-diff editor, asserts its title and that every
// row's LEFT side is the revA commit, and returns the changed-file rows so each
// test can assert the RIGHT side. The multi-diff editor IS the file list: one
// tab, every changed file with its inline diff, click a row to jump to it.
const expectMultiDiff = async ({
  title,
  leftSha,
}: {
  title: string;
  leftSha: string;
}): Promise<readonly MultiDiffEntry[]> => {
  const tab = await waitForMultiDiffTab();
  assert.equal(labelStrings(tab), title, "multi-diff editor title");
  assert.doesNotMatch(labelStrings(tab), /git/, "the literal 'git' must never leak into the title");
  assert.doesNotMatch(labelStrings(tab), /—/, "the changes-list title carries no per-file basename");
  const entries = multiDiffEntries(tab);
  assert.ok(entries.length >= 1, "at least one changed file is listed");
  for (const e of entries) {
    assert.match(
      e.original.toString(),
      new RegExp(`^diffr://commit/${leftSha}/`),
      `every left side must be commit ${short(leftSha)} — got ${e.original.toString()}`
    );
  }
  return entries;
};

const assertRightIsWorkingCopy = (entries: readonly MultiDiffEntry[]): void => {
  for (const e of entries) {
    assert.equal(e.modified.scheme, "file", `right side is the on-disk working copy — got ${e.modified.toString()}`);
  }
};

const assertRightIsIndex = (entries: readonly MultiDiffEntry[]): void => {
  for (const e of entries) {
    assert.match(e.modified.toString(), /^diffr:\/\/index\//, `right side is the index — got ${e.modified.toString()}`);
  }
};

const assertRightIsCommit = (entries: readonly MultiDiffEntry[], sha: string): void => {
  for (const e of entries) {
    assert.match(
      e.modified.toString(),
      new RegExp(`^diffr://commit/${sha}/`),
      `right side is commit ${short(sha)} — got ${e.modified.toString()}`
    );
  }
};

const aTxtEntry = (entries: readonly MultiDiffEntry[]): MultiDiffEntry | undefined =>
  entries.find((e) => e.original.toString().endsWith("/a.txt"));

describe("Diffr commands — end-to-end through real QuickPick UI", () => {
  before(async () => {
    await ensureActivated();
  });

  beforeEach(async () => {
    await closeAllEditors();
    await dismissQuickPick();
    await tick(5);
  });

  afterEach(async () => {
    await dismissQuickPick();
    await closeAllEditors();
    await tick(5);
  });

  it("reopenLast with no prior comparison shows an info toast and opens no diff", async () => {
    // This test must run BEFORE any compareXxx test that sets the memento.
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.reopenLast);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before, "no multi-diff should open when memento is empty");
  });

  it("compareFileWithCommit with no uri and no active editor → warning, no diff", async () => {
    await closeAllEditors();
    await tick(20);
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareFileWithCommit);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareFileWithCommit with a file outside any repo → warning, no diff", async () => {
    const outside = vscode.Uri.file("/tmp/diffr-not-in-any-repo.txt");
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareFileWithCommit, outside);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareWithWorkingCopy without a historyItem → warning, no diff", async () => {
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before);
  });

  it("compareWithPrevious without a historyItem → warning, no diff", async () => {
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before);
  });

  it("compareWithPrevious({id:initial-commit}) → revParse fails → reports error, no diff", async () => {
    const shas = readSeedShas();
    const before = allMultiDiffTabs().length;
    // commit 1 has no parent, so revParse(`${commit1}^1`) fails.
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, {
      id: shas.first,
    });
    await tick(80);
    assert.equal(allMultiDiffTabs().length, before);
  });

  it("compareTwoCommits: top commit (sha3) vs Working Copy → multi-diff lists files, left=sha3 right=working copy", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareTwoCommits);

    // CommitPicker: top item = most recent (commit 3)
    await accept();
    // SideBPicker: top item = Working Copy
    await accept();

    const entries = await expectMultiDiff({ title: `${short(shas.third)} ↔ Working Copy`, leftSha: shas.third });
    assertRightIsWorkingCopy(entries);
    const a = aTxtEntry(entries);
    assert.ok(a, "a.txt is one of the changed rows");
    assert.match(a.original.toString(), new RegExp(`diffr://commit/${shas.third}/a\\.txt$`));
    assert.match(a.modified.fsPath.replace(/\\/g, "/"), /\/a\.txt$/);

    await dismissQuickPick();
    await flow;
  });

  it("compareTwoCommits: pick oldest commit (sha1) vs Working Copy → multi-diff left=sha1", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareTwoCommits);

    // CommitPicker: navigate down 2 (commit 3 → 2 → 1)
    await moveAndAccept(2);
    // SideBPicker: top = Working Copy
    await accept();

    const entries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Working Copy`, leftSha: shas.first });
    assertRightIsWorkingCopy(entries);
    assert.ok(aTxtEntry(entries), "a.txt changed between commit 1 and the working copy");

    await dismissQuickPick();
    await flow;
  });

  it("compareWith(historyItem={id:sha1}) → SideB=Working Copy → multi-diff opens", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, { id: shas.first });

    // SideBPicker: top = Working Copy
    await accept();

    const entries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Working Copy`, leftSha: shas.first });
    assertRightIsWorkingCopy(entries);
    assert.ok(aTxtEntry(entries), "a.txt is listed");

    await dismissQuickPick();
    await flow;
  });

  it("compareWith(historyItem) → SideB=Index → every row's right side is diffr://index/", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, { historyItem: { id: shas.first } });

    // SideBPicker: Working Copy, Index, Pick a commit…, Pick a branch or tag…
    // Index is item 2 → moveNext × 1, accept
    await moveAndAccept(1);

    const entries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Index`, leftSha: shas.first });
    assertRightIsIndex(entries);

    await dismissQuickPick();
    await flow;
  });

  it("compareWith → SideB=pickRef → user picks the v0.1.0 tag → multi-diff vs that ref", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, { id: shas.third });

    // SideBPicker: pickRef is item 4 → moveNext × 3
    await moveAndAccept(3);
    // RefPicker (current branch `main` excluded): feature first, v0.1.0 second.
    await moveAndAccept(1);

    const entries = await expectMultiDiff({
      title: `${short(shas.third)} ↔ ${short(shas.second)}`,
      leftSha: shas.third,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });

  it("compareWith → SideB=pickCommit → user picks commit 1 → multi-diff vs commit 1", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, { id: shas.third });

    // SideBPicker: pickCommit is item 3 → moveNext × 2, accept
    await moveAndAccept(2);
    // Inner CommitPicker: commit3, commit2, commit1 → pick commit1 (moveNext × 2)
    await moveAndAccept(2);

    const entries = await expectMultiDiff({
      title: `${short(shas.third)} ↔ ${short(shas.first)}`,
      leftSha: shas.third,
    });
    assertRightIsCommit(entries, shas.first);

    await dismissQuickPick();
    await flow;
  });

  it("compareWithWorkingCopy(historyItem={id:sha2}) → no SideB picker, straight to multi-diff", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy, { id: shas.second });

    const entries = await expectMultiDiff({ title: `${short(shas.second)} ↔ Working Copy`, leftSha: shas.second });
    assertRightIsWorkingCopy(entries);
    assert.ok(aTxtEntry(entries), "a.txt changed between commit 2 and the working copy");

    await flow;
  });

  it("compareWithPrevious(historyItem={id:sha3}) → multi-diff against parent (commit 2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, { id: shas.third });

    const entries = await expectMultiDiff({
      title: `${short(shas.third)} ↔ ${short(shas.second)}`,
      leftSha: shas.third,
    });
    assertRightIsCommit(entries, shas.second);

    await flow;
  });

  it("compareFileWithCommit (with explicit uri arg) → CommitPicker top → single diff opens for commit 3", async () => {
    const aTxt = vscode.Uri.file(`${workspaceRoot()}/a.txt`);
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithCommit, aTxt);

    // CommitPicker top = commit 3
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.third}/a\\.txt$`));
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${short(shas.third)} ↔ Working Copy — a\\.txt$`));

    await flow;
  });

  it("compareFileWithCommit (no uri arg, falls back to active editor) → moveNext to commit 1 → single diff", async () => {
    const shas = readSeedShas();
    await openFileInEditor("dir/c.txt");
    await tick(20);
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithCommit);

    // moveNext × 2 to commit 1, accept
    await moveAndAccept(2);

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/dir/c\\.txt$`));
    assert.match(uris.right.fsPath.replace(/\\/g, "/"), /dir\/c\.txt$/);

    await flow;
  });

  it("reopenLast: runs compareWithWorkingCopy first, then re-invokes reopenLast and gets the same multi-diff", async () => {
    const shas = readSeedShas();
    // Setup: produce a known last-comparison entry by running compareWithWorkingCopy.
    const setup = vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy, { id: shas.first });
    const firstEntries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Working Copy`, leftSha: shas.first });
    assertRightIsWorkingCopy(firstEntries);
    await setup;
    await closeAllEditors();
    await tick(10);

    // Now re-invoke reopenLast — state remembered the comparison.
    const reflow = vscode.commands.executeCommand(COMMAND_IDS.reopenLast);
    const reEntries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Working Copy`, leftSha: shas.first });
    assertRightIsWorkingCopy(reEntries);

    await reflow;
  });

  it("compareWith without a historyItem id shows a warning and opens no diff", async () => {
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWith, undefined);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before, "no new multi-diff tab should appear");
  });

  it("compareWithPrevious(historyItem) with the wrapped { historyItem: {...} } shape still works", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, {
      historyItem: { id: shas.second },
    });
    const entries = await expectMultiDiff({
      title: `${short(shas.second)} ↔ ${short(shas.first)}`,
      leftSha: shas.second,
    });
    assertRightIsCommit(entries, shas.first);
    await flow;
  });

  it("compareWithBranch(historyItem={id:sha1}) → branch-filtered RefPicker hides `main` → multi-diff vs feature(=sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithBranch, { id: shas.first });

    // RefPicker (branch filter): `main` hidden, only `feature` (at sha2). Accept.
    await accept();

    const entries = await expectMultiDiff({
      title: `${short(shas.first)} ↔ ${short(shas.second)}`,
      leftSha: shas.first,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });

  it("compareWithBranch without a historyItem → warning, no diff", async () => {
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithBranch);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before);
  });

  it("compareWithTag(historyItem={id:sha1}) → tag-filtered RefPicker → multi-diff vs v0.1.0(=sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithTag, { historyItem: { id: shas.first } });

    // RefPicker (tag filter): only `v0.1.0` (at sha2). Accept.
    await accept();

    const entries = await expectMultiDiff({
      title: `${short(shas.first)} ↔ ${short(shas.second)}`,
      leftSha: shas.first,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });

  it("compareWithTag without a historyItem → warning, no diff", async () => {
    const before = allMultiDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithTag);
    await tick(40);
    assert.equal(allMultiDiffTabs().length, before);
  });

  it("compareFileWithBranch(uri:a.txt) → branch RefPicker hides `main` → single diff for feature(=sha2) vs working copy", async () => {
    const shas = readSeedShas();
    const aTxt = vscode.Uri.file(`${workspaceRoot()}/a.txt`);
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithBranch, aTxt);

    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/a\\.txt$`));
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${short(shas.second)} ↔ Working Copy — a\\.txt$`));

    await flow;
  });

  it("compareFileWithTag(uri:a.txt) → RefPicker shows only tags → single diff for v0.1.0(=sha2) vs working copy", async () => {
    const shas = readSeedShas();
    const aTxt = vscode.Uri.file(`${workspaceRoot()}/a.txt`);
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithTag, aTxt);

    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/a\\.txt$`));
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${short(shas.second)} ↔ Working Copy — a\\.txt$`));

    await flow;
  });

  it("compareFileWithBranch with no uri and no active editor → warning, no diff", async () => {
    await closeAllEditors();
    await tick(20);
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareFileWithBranch);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareFileWithTag with a file outside any repo → warning, no diff", async () => {
    const outside = vscode.Uri.file("/tmp/diffr-not-in-any-repo.txt");
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareFileWithTag, outside);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });
});

// These drive each commit-graph context-menu command with the EXACT argument
// shape a real right-click in the SCM history graph produces: the git
// SourceControl provider (id "git") first, then the history item. They prove the
// menu actions open the correct multi-diff end-to-end — not just the synthetic
// single-argument shape used above.
describe("Diffr commit-graph context menu — real SCM history-item invocation", () => {
  before(async () => {
    await ensureActivated();
  });

  beforeEach(async () => {
    await closeAllEditors();
    await dismissQuickPick();
    await tick(5);
  });

  afterEach(async () => {
    await dismissQuickPick();
    await closeAllEditors();
    await tick(5);
  });

  it("compareWith [graph]: provider+historyItem → SideB=Working Copy → multi-diff for the commit", async () => {
    const shas = readSeedShas();
    const before = allMultiDiffTabs().length;
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, ...scmHistoryArgs(shas.first, []));

    await accept(); // SideBPicker: Working Copy

    const entries = await expectMultiDiff({ title: `${short(shas.first)} ↔ Working Copy`, leftSha: shas.first });
    assertRightIsWorkingCopy(entries);
    assert.equal(allMultiDiffTabs().length, before + 1, "exactly one multi-diff tab opened");

    await dismissQuickPick();
    await flow;
  });

  it("compareWith [graph]: provider+historyItem → SideB=pick branch/tag → picks v0.1.0 → multi-diff vs that ref", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, ...scmHistoryArgs(shas.third, [shas.second]));

    await moveAndAccept(3); // SideBPicker → "Pick a branch or tag…"
    await moveAndAccept(1); // RefPicker → v0.1.0

    const entries = await expectMultiDiff({
      title: `${short(shas.third)} ↔ ${short(shas.second)}`,
      leftSha: shas.third,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });

  it("compareWithWorkingCopy [graph]: provider+historyItem → straight to multi-diff vs working copy", async () => {
    const shas = readSeedShas();
    const before = allMultiDiffTabs().length;
    const flow = vscode.commands.executeCommand(
      COMMAND_IDS.compareWithWorkingCopy,
      ...scmHistoryArgs(shas.second, [shas.first])
    );

    const entries = await expectMultiDiff({ title: `${short(shas.second)} ↔ Working Copy`, leftSha: shas.second });
    assertRightIsWorkingCopy(entries);
    assert.equal(allMultiDiffTabs().length, before + 1, "exactly one multi-diff tab opened");

    await flow;
  });

  it("compareWithPrevious [graph]: provider+historyItem(sha3) → multi-diff against parent (sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(
      COMMAND_IDS.compareWithPrevious,
      ...scmHistoryArgs(shas.third, [shas.second])
    );

    const entries = await expectMultiDiff({
      title: `${short(shas.third)} ↔ ${short(shas.second)}`,
      leftSha: shas.third,
    });
    assertRightIsCommit(entries, shas.second);

    await flow;
  });

  it("compareWithBranch [graph]: provider+historyItem → branch RefPicker hides `main` → multi-diff vs feature(sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithBranch, ...scmHistoryArgs(shas.first, []));

    await accept(); // RefPicker (branch filter) → feature

    const entries = await expectMultiDiff({
      title: `${short(shas.first)} ↔ ${short(shas.second)}`,
      leftSha: shas.first,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });

  it("compareWithTag [graph]: provider+historyItem → tag RefPicker → multi-diff vs v0.1.0(sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithTag, ...scmHistoryArgs(shas.first, []));

    await accept(); // RefPicker (tag filter) → v0.1.0

    const entries = await expectMultiDiff({
      title: `${short(shas.first)} ↔ ${short(shas.second)}`,
      leftSha: shas.first,
    });
    assertRightIsCommit(entries, shas.second);

    await dismissQuickPick();
    await flow;
  });
});
