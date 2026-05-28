import * as vscode from "vscode";
import {
  BUILT_IN_COMMANDS,
  COMMAND_IDS,
  CONTEXT_KEYS,
  LOG_EVENTS,
  LOG_LEVELS,
  OUTPUT_CHANNEL_NAME,
  REF_TYPES,
  TITLE_PREFIX,
  UI_TEXT,
} from "./constants";
import { createGitRunner } from "./git/GitRunner";
import { type GitApi, getGitApi } from "./vscodeGitApi";
import { addLogStream, logger } from "./logger";
import { makeCompareFileWithCommit } from "./commands/compareFileWithCommit";
import { FILE_REV_SOURCES, makeCompareFileWithRev } from "./commands/compareFileWithRev";
import { makeCompareTwoCommits } from "./commands/compareTwoCommits";
import { makeCompareWith } from "./commands/compareWith";
import { makeCompareWithPrevious } from "./commands/compareWithPrevious";
import { makeCompareWithRef } from "./commands/compareWithRef";
import { makeCompareWithWorkingCopy } from "./commands/compareWithWorkingCopy";
import { makeReopenLast } from "./commands/reopenLast";
import { registerDiffrContentProvider } from "./providers/DiffrContentProvider";
import type { CommandDeps } from "./commands/shared";
import { buildRepo } from "./commands/shared";
import { createMementoStore } from "./state";
import type { GitRunner } from "./git/GitRunner";

const GIT_VERSION_ARG = "--version";
const GIT_MISSING_MESSAGE = `${TITLE_PREFIX} git binary not found on PATH ${UI_TEXT.pathDash} commands disabled.`;
const GIT_API_MISSING_MESSAGE = `${TITLE_PREFIX} built-in git extension API unavailable.`;
const TRAILING_NEWLINE = /\n$/;

const channelStream = (channel: vscode.OutputChannel): NodeJS.WritableStream => {
  const stream = {
    write(chunk: string | Uint8Array): boolean {
      const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      channel.appendLine(text.replace(TRAILING_NEWLINE, ""));
      return true;
    },
  };
  return stream as NodeJS.WritableStream;
};

const probeGit = async (runner: GitRunner): Promise<boolean> => {
  const r = await runner.run({ args: [GIT_VERSION_ARG], cwd: process.cwd() });
  return r.ok;
};

const setGitAvailable = async (available: boolean): Promise<void> => {
  await vscode.commands.executeCommand(BUILT_IN_COMMANDS.setContext, CONTEXT_KEYS.gitAvailable, available);
};

const makeRepoResolver = (api: GitApi, runner: GitRunner) => () => {
  const first = api.repositories[0];
  if (first === undefined) {
    return undefined;
  }
  return buildRepo(runner, first);
};

const registerAll = (
  context: vscode.ExtensionContext,
  deps: CommandDeps & { readonly state: ReturnType<typeof createMementoStore> }
): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_IDS.compareWith, makeCompareWith(deps)),
    vscode.commands.registerCommand(COMMAND_IDS.compareWithWorkingCopy, makeCompareWithWorkingCopy(deps)),
    vscode.commands.registerCommand(COMMAND_IDS.compareWithPrevious, makeCompareWithPrevious(deps)),
    vscode.commands.registerCommand(
      COMMAND_IDS.compareWithBranch,
      makeCompareWithRef({ deps, filter: REF_TYPES.branch })
    ),
    vscode.commands.registerCommand(COMMAND_IDS.compareWithTag, makeCompareWithRef({ deps, filter: REF_TYPES.tag })),
    vscode.commands.registerCommand(COMMAND_IDS.compareTwoCommits, makeCompareTwoCommits(deps)),
    vscode.commands.registerCommand(COMMAND_IDS.compareFileWithCommit, makeCompareFileWithCommit(deps)),
    vscode.commands.registerCommand(
      COMMAND_IDS.compareFileWithBranch,
      makeCompareFileWithRev({ deps, source: FILE_REV_SOURCES.branch })
    ),
    vscode.commands.registerCommand(
      COMMAND_IDS.compareFileWithTag,
      makeCompareFileWithRev({ deps, source: FILE_REV_SOURCES.tag })
    ),
    vscode.commands.registerCommand(COMMAND_IDS.reopenLast, makeReopenLast(deps)),
    vscode.commands.registerCommand(COMMAND_IDS.showLogs, () => {
      deps.output.show(true);
    })
  );
};

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const output = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(output);
  addLogStream({ stream: channelStream(output), level: LOG_LEVELS.info });

  const runner = createGitRunner({ logger });
  const gitOk = await probeGit(runner);
  await setGitAvailable(gitOk);
  if (!gitOk) {
    output.appendLine(GIT_MISSING_MESSAGE);
  }

  const api = await getGitApi();
  if (api === undefined) {
    output.appendLine(GIT_API_MISSING_MESSAGE);
    return;
  }

  const state = createMementoStore(context.globalState);
  const deps = { runner, gitApi: api, output, state } as const;
  registerDiffrContentProvider(context, makeRepoResolver(api, runner));
  registerAll(context, deps);
  logger.info({ repos: api.repositories.length }, LOG_EVENTS.extensionActivated);
};

export const deactivate = (): void => {
  logger.info({}, LOG_EVENTS.extensionDeactivated);
};
