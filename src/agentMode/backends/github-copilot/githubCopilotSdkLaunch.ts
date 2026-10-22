import { getSettings } from "@/settings/model";
import { requireNodeModule } from "@/utils/desktopRuntime";
import { GITHUB_COPILOT_NOT_FOUND_MESSAGE, githubCopilotChildEnv } from "./GitHubCopilotBackend";
import { githubCopilotLaunch } from "./descriptor";
import { githubCopilotHomeDir } from "./githubCopilotHome";

// Quick Chat's per-request sessions live in their own folder so they never appear in Agent Chat's
// session list. https://github.com/spectre009/obsidian-copilot/issues/3
export const GITHUB_COPILOT_QUICK_CHAT_HOME = "quick-chat";

export interface GitHubCopilotSdkLaunchSpec {
  binaryPath: string;
  env: Record<string, string>;
  homeDir: string;
}

type MakeDirectory = (path: string, options: { recursive: true }) => Promise<unknown>;

function defaultMakeDirectory(): MakeDirectory {
  return requireNodeModule<typeof import("node:fs")>("fs").promises.mkdir;
}

/**
 * Resolves how Quick Chat starts the GitHub Copilot CLI for a vault: the same binary, version check
 * and environment rules as the agent backend, with a Quick Chat home inside the vault's Copilot
 * home. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param vaultBasePath the vault's folder on disk, which selects its Copilot home
 * @param makeDirectory creates the Quick Chat home, which is also the CLI's working directory
 */
export async function prepareGitHubCopilotSdkLaunch(
  vaultBasePath: string,
  makeDirectory: MakeDirectory = defaultMakeDirectory()
): Promise<GitHubCopilotSdkLaunchSpec> {
  const settings = getSettings();
  const binaryPath = githubCopilotLaunch.resolveBinary(settings);
  if (!binaryPath) throw new Error(GITHUB_COPILOT_NOT_FOUND_MESSAGE);
  const os = requireNodeModule<typeof import("node:os")>("os");
  const path = requireNodeModule<typeof import("node:path")>("path");
  const homeDir = path.join(
    githubCopilotHomeDir(os.homedir(), vaultBasePath),
    GITHUB_COPILOT_QUICK_CHAT_HOME
  );
  const env = githubCopilotChildEnv(settings, homeDir, binaryPath);
  await githubCopilotLaunch.assertCompatible(binaryPath, env);
  // The CLI starts in its home, and a process can't start in a folder that doesn't exist yet.
  // https://github.com/spectre009/obsidian-copilot/issues/3
  await makeDirectory(homeDir, { recursive: true });
  const defined: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) defined[key] = value;
  }
  return { binaryPath, env: defined, homeDir };
}

/**
 * The settings that change how Quick Chat's CLI starts, so a change can restart it.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param settings the current settings
 */
export function githubCopilotSdkLaunchKey(settings: ReturnType<typeof getSettings>): string {
  const backend = settings.agentMode?.backends?.["github-copilot"];
  return JSON.stringify([
    backend?.binaryPath ?? null,
    Object.entries(backend?.envOverrides ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    settings.blockVendorServices !== false,
  ]);
}
