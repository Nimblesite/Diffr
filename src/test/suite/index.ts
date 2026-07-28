import * as path from "node:path";
import Mocha from "mocha";
import { glob } from "glob";

export const run = async (): Promise<void> => {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    timeout: 60000,
    reporter: "spec",
    // Unset in CI, so the full suite always runs; set locally to focus one test.
    grep: process.env["MOCHA_GREP"],
  });
  const testsRoot = __dirname;
  const files = await glob("**/*.test.js", { cwd: testsRoot });
  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures.toString()} mocha test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
};
