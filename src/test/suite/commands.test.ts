import { strict as assert } from "node:assert";
import * as vscode from "vscode";
import { COMMAND_IDS } from "../../constants";
import {
  accept,
  allDiffTabs,
  closeAllEditors,
  dismissQuickPick,
  moveNext,
  openFileInEditor,
  readSeedShas,
  tabInputUris,
  tick,
  waitForDiffTab,
  waitForRepoReady,
  workspaceRoot,
} from "./helpers";

const EXTENSION_ID = "nimblesite.diffr";

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
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.reopenLast);
    await tick(40);
    const after = allDiffTabs().length;
    assert.equal(after, before, "no diff should open when memento is empty");
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
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareWithPrevious without a historyItem → warning, no diff", async () => {
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareWithPrevious({id:initial-commit}) → revParse fails → reports error, no diff", async () => {
    const shas = readSeedShas();
    const before = allDiffTabs().length;
    // commit 1 has no parent, so revParse(`${commit1}^1`) fails.
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, {
      id: shas.first,
    });
    await tick(80);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareTwoCommits: top commit (sha3) vs Working Copy → diff tab opens for a.txt", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareTwoCommits);

    // CommitPicker: top item = most recent (commit 3)
    await accept();
    // SideBPicker: top item = Working Copy
    await accept();
    // FilePicker: top file — accept
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.third}/`));
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), /↔ Working Copy — a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.third.slice(0, 7)}`));

    await dismissQuickPick();
    await flow;
  });

  it("compareTwoCommits: pick oldest commit (sha1) vs Working Copy → diff for top changed file", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareTwoCommits);

    // CommitPicker: navigate down 2 (commit 3 → 2 → 1)
    await moveAndAccept(2);
    // SideBPicker: top = Working Copy
    await accept();
    // FilePicker: top
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.first.slice(0, 7)} ↔ Working Copy — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWith(historyItem={id:sha1}) → SideB=Working Copy → diff opens", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, {
      id: shas.first,
    });

    // SideBPicker: top = Working Copy
    await accept();
    // FilePicker: top
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.equal(uris.right.scheme, "file");
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.first.slice(0, 7)} ↔ Working Copy — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWith(historyItem) → SideB=Index → diff has diffr://index/ on the right", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, {
      historyItem: { id: shas.first },
    });

    // SideBPicker: Working Copy, Index, Pick a commit…, Pick a branch or tag…
    // Index is item 2 → moveNext × 1, accept
    await moveAndAccept(1);
    // FilePicker
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.match(uris.right.toString(), /^diffr:\/\/index\//);
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.first.slice(0, 7)} ↔ Index — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWith → SideB=pickRef → user picks the v0.1.0 tag → diff against that ref", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, {
      id: shas.third,
    });

    // SideBPicker: Working Copy, Index, Pick a commit…, Pick a branch or tag…
    // pickRef is item 4 → moveNext × 3
    await moveAndAccept(3);

    // RefPicker (current branch `main` excluded): refs/heads/feature first,
    // refs/tags/v0.1.0 second. Pick v0.1.0 → moveNext × 1.
    await moveAndAccept(1);

    // FilePicker
    await accept();
    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.third}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.third.slice(0, 7)} ↔ ${shas.second.slice(0, 7)} — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWith → SideB=pickCommit → user picks commit 1 → diff against commit 1", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWith, {
      id: shas.third,
    });

    // SideBPicker: pickCommit is item 3 → moveNext × 2, accept
    await moveAndAccept(2);

    // Inner CommitPicker: order = commit3, commit2, commit1 (newest first)
    // Pick commit1 → moveNext × 2, accept
    await moveAndAccept(2);

    // FilePicker
    await accept();
    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.third}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.first}/`));

    await dismissQuickPick();
    await flow;
  });

  it("compareWithWorkingCopy(historyItem={id:sha2}) → no SideB picker, straight to FilePicker", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy, {
      id: shas.second,
    });

    // No SideBPicker; FilePicker opens directly
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.second.slice(0, 7)} ↔ Working Copy — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWithPrevious(historyItem={id:sha3}) → diffs against parent (commit 2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, {
      id: shas.third,
    });

    // FilePicker
    await accept();
    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.third}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.third.slice(0, 7)} ↔ ${shas.second.slice(0, 7)} — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareFileWithCommit (with explicit uri arg) → CommitPicker top → diff opens for commit 3", async () => {
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
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.third.slice(0, 7)} ↔ Working Copy — a\\.txt$`));

    await flow;
  });

  it("compareFileWithCommit (no uri arg, falls back to active editor) → moveNext to commit 1 → diff", async () => {
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

  it("reopenLast: runs compareWithWorkingCopy first, then re-invokes reopenLast and gets the same FilePicker", async () => {
    const shas = readSeedShas();
    // Setup: produce a known last-comparison entry by running compareWithWorkingCopy.
    const setup = vscode.commands.executeCommand(COMMAND_IDS.compareWithWorkingCopy, {
      id: shas.first,
    });
    await accept(); // FilePicker
    const firstDiff = await waitForDiffTab();
    const firstUris = tabInputUris(firstDiff);
    assert.match(firstUris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    await dismissQuickPick();
    await setup;
    await closeAllEditors();

    // Now re-invoke reopenLast — state remembered the comparison.
    const reflow = vscode.commands.executeCommand(COMMAND_IDS.reopenLast);
    await accept(); // FilePicker again
    const reDiff = await waitForDiffTab();
    const reUris = tabInputUris(reDiff);
    assert.match(reUris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.equal(reUris.right.scheme, "file");

    await dismissQuickPick();
    await reflow;
  });

  it("compareWith without a historyItem id shows a warning and opens no diff", async () => {
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWith, undefined);
    await tick(40);
    const after = allDiffTabs().length;
    assert.equal(after, before, "no new diff tab should appear");
  });

  it("compareWithPrevious(historyItem) with the wrapped { historyItem: {...} } shape still works", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithPrevious, {
      historyItem: { id: shas.second },
    });
    await accept(); // FilePicker
    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    await dismissQuickPick();
    await flow;
  });

  it("compareWithBranch(historyItem={id:sha1}) → branch-filtered RefPicker hides current branch `main` → diff vs feature(=sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithBranch, {
      id: shas.first,
    });

    // RefPicker with branch filter: current branch `main` is hidden, leaving
    // only `feature` (at sha2). Accept top.
    await accept();
    // FilePicker top
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.first.slice(0, 7)} ↔ ${shas.second.slice(0, 7)} — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWithBranch without a historyItem → warning, no diff", async () => {
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithBranch);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareWithTag(historyItem={id:sha1}) → tag-filtered RefPicker → diff vs v0.1.0(=sha2)", async () => {
    const shas = readSeedShas();
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareWithTag, {
      historyItem: { id: shas.first },
    });

    // RefPicker with tag filter shows only "v0.1.0" → accept top
    await accept();
    // FilePicker top
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.equal(uris.right.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.first}/`));
    assert.match(uris.right.toString(), new RegExp(`diffr://commit/${shas.second}/`));
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.first.slice(0, 7)} ↔ ${shas.second.slice(0, 7)} — `));

    await dismissQuickPick();
    await flow;
  });

  it("compareWithTag without a historyItem → warning, no diff", async () => {
    const before = allDiffTabs().length;
    await vscode.commands.executeCommand(COMMAND_IDS.compareWithTag);
    await tick(40);
    assert.equal(allDiffTabs().length, before);
  });

  it("compareFileWithBranch(uri:a.txt) → branch RefPicker hides current branch → diff opens for feature(=sha2) vs working copy", async () => {
    const shas = readSeedShas();
    const aTxt = vscode.Uri.file(`${workspaceRoot()}/a.txt`);
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithBranch, aTxt);

    // RefPicker with branch filter hides the current branch `main`, leaving
    // only `feature` (at sha2). Accept.
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/a\\.txt$`));
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.second.slice(0, 7)} ↔ Working Copy — a\\.txt$`));

    await flow;
  });

  it("compareFileWithTag(uri:a.txt) → RefPicker shows only tags → diff opens for v0.1.0(=sha2) vs working copy", async () => {
    const shas = readSeedShas();
    const aTxt = vscode.Uri.file(`${workspaceRoot()}/a.txt`);
    const flow = vscode.commands.executeCommand(COMMAND_IDS.compareFileWithTag, aTxt);

    // RefPicker with tag filter shows only "v0.1.0" → accept
    await accept();

    const diffTab = await waitForDiffTab();
    const uris = tabInputUris(diffTab);
    assert.equal(uris.left.scheme, "diffr");
    assert.match(uris.left.toString(), new RegExp(`diffr://commit/${shas.second}/a\\.txt$`));
    assert.equal(uris.right.scheme, "file");
    assert.match(uris.right.fsPath, /a\.txt$/);
    assert.match(labelStrings(diffTab), new RegExp(`^${shas.second.slice(0, 7)} ↔ Working Copy — a\\.txt$`));

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
