import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { runTests } from "@vscode/test-electron";

const repoRoot = path.resolve(__dirname, "..", "..");
const extensionDevelopmentPath = repoRoot;
const extensionTestsPath = path.resolve(__dirname, "suite", "index");
const workspacePath = path.resolve(repoRoot, "test-fixtures", "repo-seed", "workspace");
const seedScript = path.resolve(repoRoot, "test-fixtures", "repo-seed", "seed.sh");

const ensureSeedRepo = (): void => {
  if (existsSync(path.join(workspacePath, ".git"))) {
    return;
  }
  const r = spawnSync("bash", [seedScript], { stdio: "inherit" });
  if (r.status !== 0) {
    const exitLabel = r.status === null ? "?" : r.status.toString();
    throw new Error(`seed.sh failed with exit ${exitLabel}`);
  }
};

const main = async (): Promise<void> => {
  ensureSeedRepo();
  // Claude Code's host extension sets ELECTRON_RUN_AS_NODE=1 in our shell.
  // That env var, if inherited by the spawned Electron in @vscode/test-electron,
  // makes Electron behave as Node and refuse to launch VS Code. Drop it.
  if ("ELECTRON_RUN_AS_NODE" in process.env) {
    delete process.env["ELECTRON_RUN_AS_NODE"];
  }
  const coverageDir = process.env["NODE_V8_COVERAGE"];
  const extensionTestsEnv: Record<string, string> = {
    DIFFR_E2E: "1",
  };
  if (coverageDir !== undefined && coverageDir !== "") {
    extensionTestsEnv["NODE_V8_COVERAGE"] = coverageDir;
  }
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    extensionTestsEnv,
    launchArgs: [workspacePath, "--disable-telemetry", "--enable-proposed-api", "nimblesite.diffr"],
  });
};

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  process.stderr.write(`E2E tests failed: ${message}\n`);
  process.exit(1);
});
