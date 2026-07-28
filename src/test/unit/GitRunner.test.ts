import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { GIT_ERROR_KINDS } from "../../constants";
import { createGitRunner } from "../../git/GitRunner";
import type { Logger } from "../../logger";
import { expectErr, expectOk } from "../../result";

// A Logger stand-in that records every structured call so we can assert the
// runner logs at the right level without writing to a real pino sink.
interface RecordedLog {
  readonly level: string;
}

const recordingLogger = (): { logger: Logger; entries: RecordedLog[] } => {
  const entries: RecordedLog[] = [];
  const at = (level: string) => (): void => {
    entries.push({ level });
  };
  const logger: Logger = {
    trace: at("trace"),
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  };
  return { logger, entries };
};

const loggedAt = (entries: readonly RecordedLog[], level: string): boolean => entries.some((e) => e.level === level);

describe("createGitRunner.run", () => {
  it("returns ok(stdout) for a zero-exit invocation (git --version)", async () => {
    const { logger, entries } = recordingLogger();
    const runner = createGitRunner({ logger });
    const r = await runner.run({ args: ["--version"], cwd: process.cwd() });
    expectOk(r);
    assert.match(r.value, /git version/);
    assert.ok(loggedAt(entries, "debug"), "start and end are logged at debug");
  });

  it("returns a nonZeroExit error with stderr and exit code for a failing command", async () => {
    const { logger } = recordingLogger();
    const runner = createGitRunner({ logger });
    // Running a repo subcommand outside any repository exits non-zero.
    const r = await runner.run({ args: ["rev-parse", "--verify", "HEAD"], cwd: tmpdir() });
    expectErr(r);
    assert.equal(r.error.kind, GIT_ERROR_KINDS.nonZeroExit);
    const code = r.error.exitCode;
    assert.ok(typeof code === "number" && code > 0, "carries the non-zero exit code");
    assert.match(r.error.message, /git rev-parse exited/);
  });

  it("returns a spawnFailed error and warns when the binary cannot be executed", async () => {
    const { logger, entries } = recordingLogger();
    const runner = createGitRunner({ logger });
    // A cwd that does not exist makes the child process fail to spawn (ENOENT),
    // which surfaces as the spawnFailed branch rather than a non-zero exit.
    const r = await runner.run({ args: ["--version"], cwd: "/no/such/dir/diffr-spawn-fail" });
    expectErr(r);
    assert.equal(r.error.kind, GIT_ERROR_KINDS.spawnFailed);
    assert.ok(loggedAt(entries, "warn"), "spawn failure is logged at warn");
  });
});
