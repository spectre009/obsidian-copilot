import type { CopilotSettings } from "@/settings/model";
import { ClaudeBackendDescriptor } from "./claude/descriptor";
import { CodexBackendDescriptor } from "./codex/descriptor";
import { GitHubCopilotBackendDescriptor } from "./github-copilot/descriptor";
import { OpencodeBackendDescriptor } from "./opencode/descriptor";
import type { BackendDescriptor, BackendId } from "@/agentMode/session/types";

export const backendRegistry: Record<BackendId, BackendDescriptor> = {
  "github-copilot": GitHubCopilotBackendDescriptor,
  opencode: OpencodeBackendDescriptor,
  claude: ClaudeBackendDescriptor,
  codex: CodexBackendDescriptor,
};

// GitHub Copilot needs no vendor service or API key, so it leads for fresh installs.
// https://github.com/spectre009/obsidian-copilot/issues/2
export const RECOMMENDED_BACKEND_ID: BackendId = GitHubCopilotBackendDescriptor.id;

let displayOrderCache: BackendDescriptor[] | null = null;

export function backendDisplayOrder(): BackendDescriptor[] {
  if (!displayOrderCache) {
    displayOrderCache = [
      GitHubCopilotBackendDescriptor,
      OpencodeBackendDescriptor,
      ClaudeBackendDescriptor,
      CodexBackendDescriptor,
    ];
  }
  return displayOrderCache;
}

export function backendNeedsSelfHostWarning(
  descriptor: BackendDescriptor,
  settings: CopilotSettings
): boolean {
  return settings.enableSelfHostMode && !descriptor.selfHostable;
}

export function getActiveBackendDescriptor(settings: CopilotSettings): BackendDescriptor {
  const id = settings.agentMode?.activeBackend ?? RECOMMENDED_BACKEND_ID;
  return backendRegistry[id] ?? GitHubCopilotBackendDescriptor;
}

export function listBackendDescriptors(): BackendDescriptor[] {
  return Object.values(backendRegistry);
}

let cloudAgentIdsCache: ReadonlySet<BackendId> | null = null;

export function getCloudAgentIds(): ReadonlySet<BackendId> {
  if (!cloudAgentIdsCache) {
    cloudAgentIdsCache = Object.freeze(
      new Set(
        Object.values(backendRegistry)
          .filter((descriptor) => !descriptor.selfHostable)
          .map((descriptor) => descriptor.id)
      )
    );
  }
  return cloudAgentIdsCache;
}
