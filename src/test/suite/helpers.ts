import { spawnSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

export const workspaceRoot = (): string => {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder === undefined) {
    throw new Error("No workspace folder open");
  }
  return folder.uri.fsPath;
};

export const gitOut = (args: readonly string[]): string => {
  const r = spawnSync("git", [...args], {
    cwd: workspaceRoot(),
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  }
  return r.stdout.trim();
};

export interface SeedShas {
  readonly first: string;
  readonly second: string;
  readonly third: string;
}

export const readSeedShas = (): SeedShas => {
  const lines = gitOut(["log", "--format=%H", "--reverse"]).split("\n");
  const [first, second, third] = lines;
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error(`Expected 3 commits, found ${lines.length.toString()}`);
  }
  return { first, second, third };
};

// Reproduces how VSCode invokes `scm/historyItem/context` commands from the
// commit graph: the SourceControl provider (whose id is "git") is passed FIRST,
// then the history item. A handler that reads the first argument's `id` by
// mistake gets the literal "git" instead of the commit SHA.
export const scmHistoryArgs = (sha: string, parentIds: readonly string[] = []): readonly [unknown, unknown] => [
  { id: "git", rootUri: vscode.Uri.file(workspaceRoot()), label: "Git" },
  { id: sha, parentIds, message: "seed commit", displayId: sha.slice(0, 8) },
];

export const tick = async (count = 30): Promise<void> => {
  await new Promise<void>((resolve) => {
    let i = 0;
    const step = (): void => {
      i++;
      if (i >= count) {
        resolve();
        return;
      }
      setImmediate(step);
    };
    setImmediate(step);
  });
};

const wait = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const PICKER_RENDER_MS = 900;

export const accept = async (): Promise<void> => {
  await wait(PICKER_RENDER_MS);
  await vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
};

export const typeText = async (text: string): Promise<void> => {
  await wait(PICKER_RENDER_MS);
  await vscode.commands.executeCommand("type", { text });
};

export const moveNext = async (): Promise<void> => {
  await wait(PICKER_RENDER_MS);
  await vscode.commands.executeCommand("workbench.action.quickOpenSelectNext");
};

export const dismissQuickPick = async (): Promise<void> => {
  await wait(50);
  await vscode.commands.executeCommand("workbench.action.closeQuickOpen");
};

export const allDiffTabs = (): vscode.Tab[] =>
  vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputTextDiff);

export const waitForDiffTab = async ({
  timeoutMs = 8000,
}: {
  timeoutMs?: number;
} = {}): Promise<vscode.Tab> => {
  return await new Promise<vscode.Tab>((resolve, reject) => {
    const existing = allDiffTabs()[0];
    if (existing !== undefined) {
      resolve(existing);
      return;
    }
    const timer = setTimeout(() => {
      sub.dispose();
      reject(new Error("Timed out waiting for diff tab"));
    }, timeoutMs);
    const sub = vscode.window.tabGroups.onDidChangeTabs(() => {
      const t = allDiffTabs()[0];
      if (t !== undefined) {
        clearTimeout(timer);
        sub.dispose();
        resolve(t);
      }
    });
  });
};

export interface MultiDiffEntry {
  readonly original: vscode.Uri;
  readonly modified: vscode.Uri;
}

// VSCode's built-in multi-diff editor tab carries a `textDiffs` array of
// {original, modified} URI pairs. `vscode.Tab.input` is typed `unknown`, so the
// `in` checks below narrow it without an `as` cast; @types/vscode in this repo
// predates the `TabInputTextMultiDiff` class, so we duck-type the runtime shape.
const multiDiffTextDiffs = (tab: vscode.Tab): readonly MultiDiffEntry[] | undefined => {
  const input = tab.input;
  if (typeof input !== "object" || input === null || !("textDiffs" in input)) {
    return undefined;
  }
  const diffs = input.textDiffs;
  return Array.isArray(diffs) ? diffs : undefined;
};

export const allMultiDiffTabs = (): vscode.Tab[] =>
  vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => multiDiffTextDiffs(t) !== undefined);

export const multiDiffEntries = (tab: vscode.Tab): readonly MultiDiffEntry[] => {
  const diffs = multiDiffTextDiffs(tab);
  if (diffs === undefined) {
    throw new Error(`Tab is not a multi-diff editor: ${tab.label}`);
  }
  return diffs;
};

const describeOpenTabs = (): string => {
  const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
  if (tabs.length === 0) {
    return "no tabs open";
  }
  return tabs
    .map((t) => {
      const input: unknown = t.input;
      const ctor = typeof input === "object" && input !== null ? input.constructor.name : typeof input;
      const hasTextDiffs = typeof input === "object" && input !== null && "textDiffs" in input;
      return `[${ctor}${hasTextDiffs ? "+textDiffs" : ""}] ${t.label}`;
    })
    .join(" | ");
};

export const waitForMultiDiffTab = async ({
  timeoutMs = 20000,
}: {
  timeoutMs?: number;
} = {}): Promise<vscode.Tab> => {
  return await new Promise<vscode.Tab>((resolve, reject) => {
    const existing = allMultiDiffTabs()[0];
    if (existing !== undefined) {
      resolve(existing);
      return;
    }
    const timer = setTimeout(() => {
      sub.dispose();
      reject(new Error(`Timed out waiting for multi-diff tab. Open tabs: ${describeOpenTabs()}`));
    }, timeoutMs);
    const sub = vscode.window.tabGroups.onDidChangeTabs(() => {
      const t = allMultiDiffTabs()[0];
      if (t !== undefined) {
        clearTimeout(timer);
        sub.dispose();
        resolve(t);
      }
    });
  });
};

export const closeAllEditors = async (): Promise<void> => {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await tick(5);
};

export const openFileInEditor = async (relPath: string): Promise<vscode.TextEditor> => {
  const uri = vscode.Uri.file(path.join(workspaceRoot(), relPath));
  const doc = await vscode.workspace.openTextDocument(uri);
  return await vscode.window.showTextDocument(doc);
};

export const tabInputUris = (tab: vscode.Tab): { left: vscode.Uri; right: vscode.Uri } => {
  if (!(tab.input instanceof vscode.TabInputTextDiff)) {
    throw new Error(`Tab is not a TabInputTextDiff: ${tab.label}`);
  }
  return { left: tab.input.original, right: tab.input.modified };
};

interface GitApiShape {
  readonly repositories: readonly { readonly rootUri: vscode.Uri }[];
  onDidOpenRepository: (handler: () => void) => { dispose: () => void };
}

interface GitExtensionShape {
  getAPI: (version: 1) => GitApiShape;
}

export const waitForRepoReady = async (timeoutMs = 15000): Promise<void> => {
  const ext = vscode.extensions.getExtension<GitExtensionShape>("vscode.git");
  if (ext === undefined) {
    throw new Error("vscode.git extension not present");
  }
  if (!ext.isActive) {
    await ext.activate();
  }
  const api = ext.exports.getAPI(1);
  if (api.repositories.length > 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.dispose();
      reject(new Error("vscode.git never opened the seeded repo"));
    }, timeoutMs);
    const sub = api.onDidOpenRepository(() => {
      clearTimeout(timer);
      sub.dispose();
      resolve();
    });
  });
};
