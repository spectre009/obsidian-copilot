import type { AcpBackend, AcpSpawnDescriptor } from "@/agentMode/acp/types";
import { augmentPathForNodeShebang } from "@/agentMode/acp/nodeShebangPath";
import { buildAgentSystemPrompt } from "@/agentMode/backends/shared/agentSystemPrompt";
import {
  buildBuiltinSkillEnv,
  sanitizeBuiltinSkillEnvOverrides,
} from "@/agentMode/backends/shared/builtinSkillEnv";
import { getSettings, type CopilotSettings } from "@/settings/model";
import { requireNodeModule } from "@/utils/desktopRuntime";
import { buildGitHubCopilotEnv } from "./githubCopilotEnv";
import { githubCopilotHomeDir, writeGitHubCopilotInstructions } from "./githubCopilotHome";

// `--no-auto-update` runs the installed binary the version check inspected, never a newer cached
// download. `--no-ask-user` keeps the agent asking in plain text, because the ACP server offers no
// question tool this client can answer. https://github.com/spectre009/obsidian-copilot/issues/2
export const GITHUB_COPILOT_ACP_ARGS = [
  "--acp",
  "--stdio",
  "--no-auto-update",
  "--no-ask-user",
] as const;

export const GITHUB_COPILOT_NOT_FOUND_MESSAGE =
  "GitHub Copilot CLI not found. Install it, then open Agent Mode settings and run Auto-detect.";

export interface GitHubCopilotLaunch {
  resolveBinary(settings: Readonly<CopilotSettings>): string | null;
  assertCompatible(binaryPath: string, env: NodeJS.ProcessEnv): Promise<void>;
}

export function githubCopilotChildEnv(
  settings: Readonly<CopilotSettings>,
  home: string,
  binaryPath: string,
  builtinSkillEnv: Readonly<Record<string, string>> = {}
): NodeJS.ProcessEnv {
  return buildGitHubCopilotEnv({
    inherited: process.env,
    builtinSkillEnv,
    overrides: sanitizeBuiltinSkillEnvOverrides(
      settings.agentMode?.backends?.["github-copilot"]?.envOverrides
    ),
    home,
    path: augmentPathForNodeShebang(binaryPath, process.env.PATH),
    settings,
  });
}

/**
 * Starts the user's installed GitHub Copilot CLI as an ACP agent for one vault, with that vault's
 * own Copilot home. https://github.com/spectre009/obsidian-copilot/issues/2
 */
export class GitHubCopilotBackend implements AcpBackend {
  readonly id = "github-copilot" as const;
  readonly displayName = "GitHub Copilot";

  constructor(
    private readonly clientVersion: string,
    private readonly launch: GitHubCopilotLaunch
  ) {}

  async buildSpawnDescriptor(ctx: { vaultBasePath: string }): Promise<AcpSpawnDescriptor> {
    const settings = getSettings();
    const command = this.launch.resolveBinary(settings);
    if (!command) throw new Error(GITHUB_COPILOT_NOT_FOUND_MESSAGE);
    const os = requireNodeModule<typeof import("node:os")>("os");
    const home = githubCopilotHomeDir(os.homedir(), ctx.vaultBasePath);
    const env = githubCopilotChildEnv(
      settings,
      home,
      command,
      await buildBuiltinSkillEnv(this.clientVersion, ctx.vaultBasePath)
    );
    await this.launch.assertCompatible(command, env);
    await writeGitHubCopilotInstructions(home, buildAgentSystemPrompt(this.id));
    return { command, args: [...GITHUB_COPILOT_ACP_ARGS], cwd: ctx.vaultBasePath, env };
  }
}
