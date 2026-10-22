import type { GitHubCopilotSdkClient } from "./githubCopilotSdkClient";

let activeClient: GitHubCopilotSdkClient | null = null;
let activeChatModelName: string | null = null;

/**
 * Publishes the plugin's GitHub Copilot client so chat models built by the model factory can reach
 * it. Only the plugin's startup sets it, and only on desktop.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param client the running client, or null when Quick Chat on GitHub Copilot is unavailable
 */
export function setGitHubCopilotSdkClient(client: GitHubCopilotSdkClient | null): void {
  activeClient = client;
}

export function getGitHubCopilotSdkClient(): GitHubCopilotSdkClient | null {
  return activeClient;
}

/**
 * Records which GitHub Copilot model Quick Chat is using, if any, so context compaction can respect
 * its window without loading the chat model factory.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param modelName the model id, or null when Quick Chat uses another provider
 */
export function setActiveGitHubCopilotChatModel(modelName: string | null): void {
  activeChatModelName = modelName;
}

export function getActiveGitHubCopilotChatModel(): string | null {
  return activeChatModelName;
}
