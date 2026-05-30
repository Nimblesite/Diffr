import * as vscode from "vscode";
import { type Result, err, ok } from "../result";
import { CANCELLED, type Cancelled } from "./cancelled";

export interface QuickPickConfig<T extends vscode.QuickPickItem> {
  readonly items: readonly T[];
  readonly placeholder: string;
  readonly matchOnDescription?: boolean;
  readonly matchOnDetail?: boolean;
}

const createConfiguredPicker = <T extends vscode.QuickPickItem>(config: QuickPickConfig<T>): vscode.QuickPick<T> => {
  const qp = vscode.window.createQuickPick<T>();
  qp.placeholder = config.placeholder;
  qp.matchOnDescription = config.matchOnDescription ?? false;
  qp.matchOnDetail = config.matchOnDetail ?? false;
  qp.items = config.items;
  return qp;
};

export const showSinglePick = async <T extends vscode.QuickPickItem>(
  config: QuickPickConfig<T>
): Promise<Result<T, Cancelled>> =>
  await new Promise<Result<T, Cancelled>>((resolve) => {
    const qp = createConfiguredPicker(config);
    let settled = false;
    const finish = (r: Result<T, Cancelled>): void => {
      if (settled) {
        return;
      }
      settled = true;
      qp.dispose();
      resolve(r);
    };
    qp.onDidAccept(() => {
      const choice = qp.selectedItems[0] ?? qp.activeItems[0];
      finish(choice === undefined ? err(CANCELLED) : ok(choice));
    });
    qp.onDidHide(() => {
      finish(err(CANCELLED));
    });
    qp.show();
  });
