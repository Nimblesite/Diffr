import * as vscode from "vscode";
import { REV_KINDS, TITLE_PREFIX } from "../constants";
import type { GitRepo } from "../git/GitRepo";
import { toRepoRelPath } from "../git/relPath";
import type { Sha } from "../git/types";
import type { Result } from "../result";
import { err, ok } from "../result";
import { CANCELLED, type Cancelled } from "../ui/cancelled";
import { pickCommit } from "../ui/CommitPicker";
import { findRepoForUri } from "../vscodeGitApi";
import { type CommandDeps, buildRepo, openDiff } from "./shared";
import { pickRefAsSha, reportGitError, sideAFromSha } from "./flow";

export const FILE_REV_SOURCES = {
  commits: "commits",
  branch: "branch",
  tag: "tag",
  other: "other",
} as const;

export type FileRevSource = (typeof FILE_REV_SOURCES)[keyof typeof FILE_REV_SOURCES];

const NO_EDITOR = `${TITLE_PREFIX} open a file first.`;
const NOT_IN_REPO = `${TITLE_PREFIX} file is not in a git repository.`;
const LOG_OP = "log";

const pickShaForFile = async ({
  repo,
  source,
  output,
}: {
  repo: GitRepo;
  source: FileRevSource;
  output: vscode.OutputChannel;
}): Promise<Result<Sha, Cancelled>> => {
  if (source === FILE_REV_SOURCES.commits) {
    const log = await repo.log({});
    if (!log.ok) {
      reportGitError({ output, op: LOG_OP, e: log.error });
      return err(CANCELLED);
    }
    const picked = await pickCommit({ commits: log.value });
    if (!picked.ok) {
      return err(CANCELLED);
    }
    return ok(picked.value.sha);
  }
  return await pickRefAsSha({ repo, output, filter: source });
};

const resolveTargetUri = (uri?: vscode.Uri): vscode.Uri | undefined =>
  uri ?? vscode.window.activeTextEditor?.document.uri;

const handler = async ({
  deps,
  uri,
  source,
}: {
  deps: CommandDeps;
  uri: vscode.Uri | undefined;
  source: FileRevSource;
}): Promise<void> => {
  const target = resolveTargetUri(uri);
  if (target === undefined) {
    void vscode.window.showWarningMessage(NO_EDITOR);
    return;
  }
  const vsRepo = findRepoForUri(deps.gitApi, target);
  if (vsRepo === undefined) {
    void vscode.window.showWarningMessage(NOT_IN_REPO);
    return;
  }
  const repoRoot = vsRepo.rootUri.fsPath;
  const repo = buildRepo(deps.runner, vsRepo);
  const sha = await pickShaForFile({ repo, source, output: deps.output });
  if (!sha.ok) {
    return;
  }
  await openDiff({
    revA: sideAFromSha(sha.value),
    revB: { kind: REV_KINDS.workingCopy },
    repoRoot,
    relPath: toRepoRelPath({ repoRoot, fileFsPath: target.fsPath }),
  });
};

export const makeCompareFileWithRev =
  ({ deps, source }: { deps: CommandDeps; source: FileRevSource }) =>
  async (uri?: vscode.Uri): Promise<void> => {
    await handler({ deps, uri, source });
  };
