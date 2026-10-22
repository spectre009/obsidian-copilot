import type { App } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import { logInfo } from "@/logger";
import type { ModelManagementApi } from "@/modelManagement";
import { subscribeToSettingsChange } from "@/settings/model";
import { isDesktopRuntime } from "@/utils/desktopRuntime";
import { setGitHubCopilotSdkClient } from "./githubCopilotClientRegistry";
import {
  findGitHubCopilotProvider,
  refreshGitHubCopilotModels,
} from "./githubCopilotModelInventory";
import { GitHubCopilotSdkClient } from "./githubCopilotSdkClient";

/**
 * Starts Quick Chat on GitHub Copilot for this vault on desktop: creates the shared CLI client,
 * reads the model list once at startup (and again after Reset Settings drops the inventory), and
 * restarts the CLI when its launch settings change. Returns the teardown, which stops the CLI.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param app the Obsidian app, whose vault folder selects the Copilot home
 * @param modelManagement the plugin's model management
 * @param clientVersion the plugin version, reported to the CLI
 */
export async function startGitHubCopilotQuickChat(
  app: App,
  modelManagement: ModelManagementApi,
  clientVersion: string
): Promise<() => Promise<void>> {
  const adapter = app.vault.adapter;
  if (!isDesktopRuntime() || !(adapter instanceof FileSystemAdapter)) {
    logInfo("[GitHubCopilot] Quick Chat on GitHub Copilot needs the desktop app");
    return async () => undefined;
  }
  const vaultBasePath = adapter.getBasePath();
  const { githubCopilotSdkLaunchKey, prepareGitHubCopilotSdkLaunch } = await import("@/agentMode");

  const client = new GitHubCopilotSdkClient({
    clientVersion,
    resolveLaunch: () => prepareGitHubCopilotSdkLaunch(vaultBasePath),
  });
  setGitHubCopilotSdkClient(client);
  const refreshModels = (): Promise<void> =>
    refreshGitHubCopilotModels(modelManagement, () => client.listModels());

  const unsubscribe = subscribeToSettingsChange((prev, next) => {
    if (githubCopilotSdkLaunchKey(prev) !== githubCopilotSdkLaunchKey(next)) {
      client.invalidate("launch settings changed");
    }
    // Reset Settings removes the agent provider, and the agent's discovery won't re-enroll models
    // it has already reported, so the inventory is rebuilt here.
    // https://github.com/spectre009/obsidian-copilot/issues/3
    if (findGitHubCopilotProvider(prev.providers) && !findGitHubCopilotProvider(next.providers)) {
      void refreshModels();
    }
  });

  void refreshModels();

  return async () => {
    unsubscribe();
    setGitHubCopilotSdkClient(null);
    await client.stop();
  };
}
