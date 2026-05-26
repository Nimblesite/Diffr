import { strict as assert } from "node:assert";
import * as vscode from "vscode";
import { COMMAND_IDS, OUTPUT_CHANNEL_NAME } from "../../constants";
import { tick } from "./helpers";

const EXTENSION_ID = "nimblesite.diffy";
const TICK_MS = 20;

const ALL_COMMAND_IDS: readonly string[] = Object.values(COMMAND_IDS);

describe("activation", () => {
  it("extension is present, activates, and every command id is registered", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be present`);
    if (!ext.isActive) {
      await ext.activate();
    }
    assert.equal(ext.isActive, true, "extension should be active after activate()");
    await tick(TICK_MS);
    const registered = await vscode.commands.getCommands(true);
    for (const id of ALL_COMMAND_IDS) {
      assert.ok(
        registered.includes(id),
        `command ${id} should be registered (was: ${registered.filter((c) => c.startsWith("diffy.")).join(", ")})`
      );
    }
  });

  it("exposes a workspace folder containing the seeded git repo", () => {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders, "workspace folders should be set");
    assert.equal(folders.length, 1);
    const folder = folders[0];
    assert.ok(folder);
    assert.match(folder.uri.fsPath.replace(/\\/g, "/"), /repo-seed\/workspace$/);
  });

  it("shows logs command opens the Diffy OutputChannel without errors", async () => {
    await vscode.commands.executeCommand(COMMAND_IDS.showLogs);
    // The channel's "visible" state isn't observable from the test host, but
    // the command must have a registered handler and complete without throwing.
    assert.equal(typeof OUTPUT_CHANNEL_NAME, "string");
    assert.ok(OUTPUT_CHANNEL_NAME.length > 0);
  });
});
