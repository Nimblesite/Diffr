import { DEFAULT_LOG_LIMIT, GIT_LOG_FORMAT, REFS_FORMAT } from "../constants";
import { type Result, ok, err, andThen, map } from "../result";
import type { GitRunner } from "./GitRunner";
import { parseLog, parseNameStatus, parseNumstat, parseRefs } from "./parsers";
import type {
  ChangedFile,
  Commit,
  CommitRev,
  DiffStat,
  DiffrAddressableRev,
  GitError,
  Ref,
  RevSpec,
  Sha,
} from "./types";

export interface DiffSides {
  readonly from: CommitRev;
  readonly to: RevSpec;
}

export interface ShowArgs {
  readonly rev: DiffrAddressableRev;
  readonly path: string;
}

export interface LogArgs {
  readonly limit?: number;
  readonly ref?: string;
}

export interface GitRepo {
  log: (args?: LogArgs) => Promise<Result<readonly Commit[], GitError>>;
  nameStatus: (args: DiffSides) => Promise<Result<readonly ChangedFile[], GitError>>;
  numstat: (args: DiffSides) => Promise<Result<readonly DiffStat[], GitError>>;
  show: (args: ShowArgs) => Promise<Result<string, GitError>>;
  refs: () => Promise<Result<readonly Ref[], GitError>>;
  revParse: (name: string) => Promise<Result<Sha, GitError>>;
  currentBranch: () => Promise<Result<string | undefined, GitError>>;
}

const buildLogArgs = (params: { limit: number; ref?: string }): readonly string[] => {
  const base = ["log", `--max-count=${params.limit.toString()}`, `--format=${GIT_LOG_FORMAT}`, "-z"];
  return params.ref === undefined ? base : [...base, params.ref];
};

const buildDiffArgs = ({ from, to }: DiffSides, subcommand: "name-status" | "numstat"): readonly string[] => {
  const head = ["diff", `--${subcommand}`, "-z", "--find-renames", "--find-copies"];
  if (to.kind === "commit") {
    return [...head, from.sha, to.sha];
  }
  if (to.kind === "workingCopy") {
    return [...head, from.sha];
  }
  return [...head, from.sha, "--cached"];
};

const showSpec = ({ rev, path }: ShowArgs): string => (rev.kind === "commit" ? `${rev.sha}:${path}` : `:${path}`);

const trimSha = (stdout: string): Result<Sha, GitError> => {
  const sha = stdout.trim();
  if (sha.length === 0) {
    return err({ kind: "parseError", message: "revParse: empty output" });
  }
  return ok(sha);
};

export const createGitRepo = ({ runner, cwd }: { runner: GitRunner; cwd: string }): GitRepo => ({
  log: async (args = {}) => {
    const limit = args.limit ?? DEFAULT_LOG_LIMIT;
    const logArgs = args.ref === undefined ? buildLogArgs({ limit }) : buildLogArgs({ limit, ref: args.ref });
    const r = await runner.run({ args: logArgs, cwd });
    return andThen(r, parseLog);
  },
  nameStatus: async (args) => {
    const r = await runner.run({ args: buildDiffArgs(args, "name-status"), cwd });
    return andThen(r, parseNameStatus);
  },
  numstat: async (args) => {
    const r = await runner.run({ args: buildDiffArgs(args, "numstat"), cwd });
    return andThen(r, parseNumstat);
  },
  show: async (args) => await runner.run({ args: ["show", showSpec(args)], cwd }),
  refs: async () => {
    const r = await runner.run({
      args: ["for-each-ref", `--format=${REFS_FORMAT}`],
      cwd,
    });
    return andThen(r, parseRefs);
  },
  revParse: async (name) => {
    const r = await runner.run({ args: ["rev-parse", "--verify", name], cwd });
    return andThen(r, trimSha);
  },
  currentBranch: async () => {
    const r = await runner.run({ args: ["branch", "--show-current"], cwd });
    return map(r, (stdout) => {
      const name = stdout.trim();
      return name.length === 0 ? undefined : name;
    });
  },
});
