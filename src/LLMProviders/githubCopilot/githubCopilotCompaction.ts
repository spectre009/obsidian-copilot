import type { CopilotSettings } from "@/settings/model";
import {
  getActiveGitHubCopilotChatModel,
  getGitHubCopilotSdkClient,
} from "./githubCopilotClientRegistry";
import { promptBudgetTokens } from "./githubCopilotModels";

/**
 * The token count past which Quick Chat compacts attached context. A GitHub Copilot model can have
 * a smaller prompt budget than the setting allows, and a request over it fails outright, so the
 * threshold is capped to the selected model's budget for its context-window tier.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param settings the current settings
 */
export async function effectiveAutoCompactThreshold(
  settings: Pick<CopilotSettings, "autoCompactThreshold"> &
    Partial<Pick<CopilotSettings, "githubCopilotQuickChat">>
): Promise<number> {
  const threshold = settings.autoCompactThreshold;
  const modelName = getActiveGitHubCopilotChatModel();
  const client = getGitHubCopilotSdkClient();
  if (!modelName || !client) return threshold;
  try {
    const budget = promptBudgetTokens(
      settings.githubCopilotQuickChat?.contextWindow ?? "default",
      await client.getModel(modelName)
    );
    return budget ? Math.min(threshold, budget) : threshold;
  } catch {
    return threshold;
  }
}
