import type { ModelInfo as SdkModelInfo } from "@github/copilot-sdk";
import { logError, logInfo } from "@/logger";
import type { ModelManagementApi, Provider } from "@/modelManagement";
import { getSettings, setSettings } from "@/settings/model";
import { toConfiguredModelInfo } from "./githubCopilotModels";

const AGENT_TYPE = "github-copilot";

export const GITHUB_COPILOT_PROVIDER_DISPLAY_NAME = "GitHub Copilot";

export function findGitHubCopilotProvider(
  providers: Readonly<Record<string, Provider>>
): Provider | undefined {
  return Object.values(providers).find(
    (provider) => provider.origin.kind === "agent" && provider.origin.agentType === AGENT_TYPE
  );
}

/**
 * Seeds the shared GitHub Copilot model inventory from the CLI's model list and enrolls new models
 * in Quick Chat once. The agent backend stays the inventory's owner: this only creates it when it
 * doesn't exist and otherwise refreshes capability metadata (vision, limits, effort levels) that the
 * agent's own discovery doesn't report. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param api the plugin's model management
 * @param sdkModels the CLI's model list
 */
export async function bootstrapGitHubCopilotModels(
  api: Pick<ModelManagementApi, "setup" | "configuredModelRegistry" | "backendConfigRegistry">,
  sdkModels: readonly SdkModelInfo[]
): Promise<void> {
  const infos = sdkModels
    .filter((model) => model.policy?.state !== "disabled")
    .map(toConfiguredModelInfo);
  if (infos.length === 0) return;
  const { providerId } = await api.setup.agent.bootstrapAgentModels({
    agentType: AGENT_TYPE,
    providerType: "openai-compatible",
    displayName: GITHUB_COPILOT_PROVIDER_DISPLAY_NAME,
    models: infos,
  });
  await offerNewModelsToQuickChat(api, providerId);
}

// Each model is enrolled once, so one the user turned off in Quick Chat stays off; Reset Settings
// clears the record and the next discovery enrolls again. https://github.com/spectre009/obsidian-copilot/issues/3
async function offerNewModelsToQuickChat(
  api: Pick<ModelManagementApi, "configuredModelRegistry" | "backendConfigRegistry">,
  providerId: string
): Promise<void> {
  const offered = new Set(getSettings().githubCopilotQuickChat.offeredModelIds);
  const fresh = api.configuredModelRegistry
    .listByProvider(providerId)
    .filter((model) => !offered.has(model.info.id));
  if (fresh.length === 0) return;
  for (const model of fresh) {
    await api.backendConfigRegistry.enableModel("chat", model.configuredModelId);
  }
  setSettings((current) => ({
    githubCopilotQuickChat: {
      ...current.githubCopilotQuickChat,
      offeredModelIds: [
        ...current.githubCopilotQuickChat.offeredModelIds,
        ...fresh.map((model) => model.info.id),
      ],
    },
  }));
  logInfo(`[GitHubCopilot] Enrolled ${fresh.length} model(s) in Quick Chat`);
}

/**
 * Runs the bootstrap and logs instead of throwing, because a missing or signed-out CLI must not
 * break startup.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param api the plugin's model management
 * @param listModels reads the CLI's model list
 */
export async function refreshGitHubCopilotModels(
  api: Pick<ModelManagementApi, "setup" | "configuredModelRegistry" | "backendConfigRegistry">,
  listModels: () => Promise<SdkModelInfo[]>
): Promise<void> {
  try {
    await bootstrapGitHubCopilotModels(api, await listModels());
  } catch (error) {
    logError("[GitHubCopilot] Could not read the GitHub Copilot model list", error);
  }
}
