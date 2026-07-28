import type { MementoStore } from "../state";
import type { CommandDeps } from "./shared";
import { drillIntoFiles, pickSideBAndResolve, startFromArgsOrPick } from "./flow";

const handler = async (
  deps: CommandDeps & { readonly state: MementoStore },
  args: readonly unknown[]
): Promise<void> => {
  const start = await startFromArgsOrPick({
    args,
    runner: deps.runner,
    gitApi: deps.gitApi,
    output: deps.output,
  });
  if (start === undefined) {
    return;
  }
  const revB = await pickSideBAndResolve({ repo: start.repo, output: deps.output });
  if (!revB.ok) {
    return;
  }
  await drillIntoFiles({
    repo: start.repo,
    repoRoot: start.vsRepoRoot,
    revA: start.revA,
    revB: revB.value,
    state: deps.state,
    output: deps.output,
  });
};

export const makeCompareWith =
  (deps: CommandDeps & { readonly state: MementoStore }) =>
  async (...args: unknown[]): Promise<void> => {
    await handler(deps, args);
  };
