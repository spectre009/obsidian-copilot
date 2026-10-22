import { type App, FileSystemAdapter } from "obsidian";
import { requireNodeModule } from "@/utils/desktopRuntime";
import { md5 } from "@/utils/hash";

const COPILOT_APP_DIR_NAME = ".obsidian-copilot";

export function copilotAppDataDir(homeDir: string): string {
  const path = requireNodeModule<typeof import("node:path")>("path");
  return path.join(homeDir, COPILOT_APP_DIR_NAME);
}

export function vaultIdFromBasePath(vaultBasePath: string): string {
  return vaultBasePath ? md5(vaultBasePath).slice(0, 8) : "default";
}

export function getVaultId(app: App): string {
  const adapter = app.vault.adapter;
  return vaultIdFromBasePath(adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "");
}
