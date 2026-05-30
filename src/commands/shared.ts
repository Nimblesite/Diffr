import * as path from "node:path";
import * as vscode from "vscode";
import { BUILT_IN_COMMANDS, LOG_EVENTS, REV_KINDS, SHORT_SHA_LEN, UI_TEXT } from "../constants";
import type { GitRepo } from "../git/GitRepo";
import type { GitRunner } from "../git/GitRunner";
import { createGitRepo } from "../git/GitRepo";
import { type GitApi, type GitVsRepository, findRepoForUri } from "../vscodeGitApi";
import type { CommitRev, DiffrAddressableRev, RevSpec, Sha } from "../git/types";
import { logger } from "../logger";
import { type Result, err, ok } from "../result";
import { CANCELLED, type Cancelled } from "../ui/cancelled";
import { buildDiffrUri } from "../ui/uri";

export interface CommandDeps {
  readonly runner: GitRunner;
  readonly gitApi: GitApi;
  readonly output: vscode.OutputChannel;
}

export const shortSha = (sha: Sha): string => sha.slice(0, SHORT_SHA_LEN);

const labelForRev = (rev: RevSpec): string => {
  if (rev.kind === REV_KINDS.commit) {
    return shortSha(rev.sha);
  }
  if (rev.kind === REV_KINDS.workingCopy) {
    return UI_TEXT.workingCopy;
  }
  return UI_TEXT.indexLabel;
};

export const formatComparisonTitle = ({ revA, revB }: { revA: CommitRev; revB: RevSpec }): string =>
  `${labelForRev(revA)} ${UI_TEXT.pathArrow} ${labelForRev(revB)}`;

export const formatDiffTitle = ({
  revA,
  revB,
  basename,
}: {
  revA: CommitRev;
  revB: RevSpec;
  basename: string;
}): string => `${formatComparisonTitle({ revA, revB })} ${UI_TEXT.pathDash} ${basename}`;

export const uriForRev = ({
  rev,
  repoRoot,
  relPath,
}: {
  rev: RevSpec;
  repoRoot: string;
  relPath: string;
}): vscode.Uri => {
  if (rev.kind === REV_KINDS.workingCopy) {
    return vscode.Uri.file(path.join(repoRoot, relPath));
  }
  const addressable: DiffrAddressableRev =
    rev.kind === REV_KINDS.commit ? { kind: REV_KINDS.commit, sha: rev.sha } : { kind: REV_KINDS.index };
  return vscode.Uri.parse(buildDiffrUri(addressable, relPath));
};

export const openDiff = async ({
  revA,
  revB,
  repoRoot,
  relPath,
}: {
  revA: CommitRev;
  revB: RevSpec;
  repoRoot: string;
  relPath: string;
}): Promise<void> => {
  const left = uriForRev({ rev: revA, repoRoot, relPath });
  const right = uriForRev({ rev: revB, repoRoot, relPath });
  const title = formatDiffTitle({
    revA,
    revB,
    basename: path.basename(relPath),
  });
  logger.info({ shaA: shortSha(revA.sha), revBKind: revB.kind }, LOG_EVENTS.diffOpen);
  await vscode.commands.executeCommand(BUILT_IN_COMMANDS.diff, left, right, title);
};

// One persistent multi-diff editor listing every changed file with its full
// path and inline diff — click a row to jump to that file's diff. This is
// VSCode's built-in `vscode.changes` editor, NOT a custom view: it takes a
// title and a list of `[resource, original, modified]` URI triples. We key each
// row by the on-disk file URI so the list shows clean workspace-relative paths,
// while the actual diff sides come from `original` (revA, left) and `modified`
// (revB, right).
export const openMultiFileDiff = async ({
  revA,
  revB,
  repoRoot,
  relPaths,
}: {
  revA: CommitRev;
  revB: RevSpec;
  repoRoot: string;
  relPaths: readonly string[];
}): Promise<void> => {
  const resourceList = relPaths.map((relPath): [vscode.Uri, vscode.Uri, vscode.Uri] => [
    vscode.Uri.file(path.join(repoRoot, relPath)),
    uriForRev({ rev: revA, repoRoot, relPath }),
    uriForRev({ rev: revB, repoRoot, relPath }),
  ]);
  const title = formatComparisonTitle({ revA, revB });
  logger.info({ shaA: shortSha(revA.sha), revBKind: revB.kind, files: relPaths.length }, LOG_EVENTS.diffOpen);
  await vscode.commands.executeCommand(BUILT_IN_COMMANDS.changes, title, resourceList);
};

export const repoForUri = (api: GitApi, uri: vscode.Uri): GitVsRepository | undefined => findRepoForUri(api, uri);

export const pickRepoFrom = async (api: GitApi): Promise<Result<GitVsRepository, Cancelled>> => {
  if (api.repositories.length === 0) {
    return err(CANCELLED);
  }
  const first = api.repositories[0];
  if (api.repositories.length === 1 && first !== undefined) {
    return ok(first);
  }
  const items = api.repositories.map((r) => ({
    label: r.rootUri.fsPath,
    repo: r,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: UI_TEXT.pickRepoPlaceholder,
  });
  return picked === undefined ? err(CANCELLED) : ok(picked.repo);
};

export const buildRepo = (runner: GitRunner, vsRepo: GitVsRepository): GitRepo =>
  createGitRepo({ runner, cwd: vsRepo.rootUri.fsPath });
