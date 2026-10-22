import type { CopilotSettings } from "@/settings/model";
import { withoutVendorEnv } from "@/vendorServices/vendorServicesPolicy";

// Copilot settings a user may legitimately need to reach the GitHub host, such as a data-residency
// host or a Kerberos proxy, or that only affect interactive terminal use.
// https://github.com/spectre009/obsidian-copilot/issues/2
const COPILOT_PASSTHROUGH_KEYS: ReadonlySet<string> = new Set([
  "COPILOT_GH_HOST",
  "COPILOT_PROXY_KERBEROS_SPN",
  "COPILOT_EDITOR",
  "COPILOT_MULTIPLEXER",
]);

// Every other COPILOT_* variable can reroute models or the API, grant tool approval, add instruction
// folders, change the version run, or switch on features, so a vault agent's behavior would depend on
// whatever shell launched Obsidian. Tokens would bypass the stored login, and OTel would export prompts.
// https://github.com/spectre009/obsidian-copilot/issues/2
const PLUGIN_OWNED_KEYS: ReadonlySet<string> = new Set(["GH_TOKEN", "GITHUB_TOKEN"]);

export function isPluginOwnedGitHubCopilotEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  if (upper.startsWith("COPILOT_")) return !COPILOT_PASSTHROUGH_KEYS.has(upper);
  return PLUGIN_OWNED_KEYS.has(upper) || upper.startsWith("OTEL_");
}

function setCaseInsensitive(env: NodeJS.ProcessEnv, key: string, value: string): void {
  for (const existing of Object.keys(env)) {
    if (existing.toUpperCase() === key.toUpperCase()) delete env[existing];
  }
  env[key] = value;
}

export interface GitHubCopilotEnvInput {
  inherited: Readonly<NodeJS.ProcessEnv>;
  builtinSkillEnv?: Readonly<Record<string, string>>;
  overrides?: Readonly<Record<string, string>>;
  home: string;
  path?: string;
  settings: Pick<CopilotSettings, "blockVendorServices">;
}

/**
 * Builds the one environment the GitHub Copilot CLI runs with, for both the agent and its version
 * check, so the check describes the build and sign-in the agent uses.
 * https://github.com/spectre009/obsidian-copilot/issues/2
 */
export function buildGitHubCopilotEnv(input: GitHubCopilotEnvInput): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(input.inherited)) {
    if (!isPluginOwnedGitHubCopilotEnvKey(key)) env[key] = value;
  }
  for (const [key, value] of Object.entries(input.builtinSkillEnv ?? {})) {
    setCaseInsensitive(env, key, value);
  }
  for (const [key, value] of Object.entries(input.overrides ?? {})) {
    if (!isPluginOwnedGitHubCopilotEnvKey(key)) setCaseInsensitive(env, key, value);
  }
  if (input.path !== undefined) setCaseInsensitive(env, "PATH", input.path);
  setCaseInsensitive(env, "COPILOT_HOME", input.home);
  // Without this a launch can apply a newer CLI the auto-updater already downloaded, so the version
  // check would not describe the binary that runs. https://github.com/spectre009/obsidian-copilot/issues/2
  setCaseInsensitive(env, "COPILOT_AUTO_UPDATE", "false");
  return withoutVendorEnv(env, input.settings);
}
