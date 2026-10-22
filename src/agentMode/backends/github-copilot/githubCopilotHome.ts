import { copilotAppDataDir, vaultIdFromBasePath } from "@/utils/appPaths";
import { requireNodeModule } from "@/utils/desktopRuntime";

export const GITHUB_COPILOT_INSTRUCTIONS_FILE = "copilot-instructions.md";

// Commands that do not depend on a vault, such as the version check, run with this as their home.
// https://github.com/spectre009/obsidian-copilot/issues/2
export function githubCopilotHomesRoot(homeDir: string): string {
  const path = requireNodeModule<typeof import("node:path")>("path");
  return path.join(copilotAppDataDir(homeDir), "github-copilot");
}

// The home lives outside the vault so the CLI's sessions, logs and config neither sync nor appear as
// notes. https://github.com/spectre009/obsidian-copilot/issues/2
export function githubCopilotHomeDir(homeDir: string, vaultBasePath: string): string {
  const path = requireNodeModule<typeof import("node:path")>("path");
  // One home per vault keeps two open vaults from overwriting each other's system prompt while
  // either agent starts. https://github.com/spectre009/obsidian-copilot/issues/2
  return path.join(githubCopilotHomesRoot(homeDir), vaultIdFromBasePath(vaultBasePath));
}

export interface GitHubCopilotHomeFs {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  writeFile(path: string, content: string, encoding: "utf8"): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
}

function defaultHomeFs(): GitHubCopilotHomeFs {
  return requireNodeModule<typeof import("node:fs")>("fs").promises;
}

let tempWriteCount = 0;

// The CLI reads `$COPILOT_HOME/copilot-instructions.md` as user-level instructions; its own files in
// the home are left alone. https://github.com/spectre009/obsidian-copilot/issues/2
export async function writeGitHubCopilotInstructions(
  home: string,
  content: string,
  fs: GitHubCopilotHomeFs = defaultHomeFs()
): Promise<void> {
  const path = requireNodeModule<typeof import("node:path")>("path");
  await fs.mkdir(home, { recursive: true });
  const target = path.join(home, GITHUB_COPILOT_INSTRUCTIONS_FILE);
  const temp = `${target}.${process.pid}.${Date.now()}.${++tempWriteCount}.tmp`;
  // A CLI starting while the prompt is rewritten must read the old file or the new one, never a
  // partial write. https://github.com/spectre009/obsidian-copilot/issues/2
  try {
    await fs.writeFile(temp, content, "utf8");
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}
