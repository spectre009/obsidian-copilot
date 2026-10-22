/**
 * Quick Chat settings for GitHub Copilot models. They live in their own module so the fork's
 * additions to the settings model stay in one place.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */

export const GITHUB_COPILOT_THINKING_LEVELS = [
  "default",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type GitHubCopilotThinkingLevel = (typeof GITHUB_COPILOT_THINKING_LEVELS)[number];

export const GITHUB_COPILOT_CONTEXT_WINDOWS = ["default", "long_context"] as const;

export type GitHubCopilotContextWindow = (typeof GITHUB_COPILOT_CONTEXT_WINDOWS)[number];

export interface GitHubCopilotQuickChatSettings {
  thinkingLevel: GitHubCopilotThinkingLevel;
  contextWindow: GitHubCopilotContextWindow;
  backgroundThinkingLevel: GitHubCopilotThinkingLevel;
  /** Model ids already enrolled in Quick Chat once, so a model the user turned off stays off. https://github.com/spectre009/obsidian-copilot/issues/3 */
  offeredModelIds: string[];
}

/** Background calls default to Claude Haiku 4.5, the cheapest GitHub Copilot model. https://github.com/spectre009/obsidian-copilot/issues/3 */
export const DEFAULT_BACKGROUND_MODEL_KEY = "claude-haiku-4.5|github-copilot";

const EMPTY_OFFERED_MODEL_IDS: string[] = Object.freeze([]) as unknown as string[];

export const DEFAULT_GITHUB_COPILOT_QUICK_CHAT: GitHubCopilotQuickChatSettings = Object.freeze({
  thinkingLevel: "default",
  contextWindow: "default",
  backgroundThinkingLevel: "low",
  offeredModelIds: EMPTY_OFFERED_MODEL_IDS,
});

export function isGitHubCopilotThinkingLevel(value: unknown): value is GitHubCopilotThinkingLevel {
  return (GITHUB_COPILOT_THINKING_LEVELS as readonly unknown[]).includes(value);
}

export function isGitHubCopilotContextWindow(value: unknown): value is GitHubCopilotContextWindow {
  return (GITHUB_COPILOT_CONTEXT_WINDOWS as readonly unknown[]).includes(value);
}

/**
 * Repairs a stored Quick Chat slice field by field, so one corrupt value falls back to its default
 * without discarding the others. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param raw the persisted value, which may be missing or malformed
 */
export function sanitizeGitHubCopilotQuickChatSettings(
  raw: unknown
): GitHubCopilotQuickChatSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_GITHUB_COPILOT_QUICK_CHAT;
  const r = raw as Record<string, unknown>;
  const offered = Array.isArray(r.offeredModelIds)
    ? r.offeredModelIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : DEFAULT_GITHUB_COPILOT_QUICK_CHAT.offeredModelIds;
  return {
    thinkingLevel: isGitHubCopilotThinkingLevel(r.thinkingLevel)
      ? r.thinkingLevel
      : DEFAULT_GITHUB_COPILOT_QUICK_CHAT.thinkingLevel,
    contextWindow: isGitHubCopilotContextWindow(r.contextWindow)
      ? r.contextWindow
      : DEFAULT_GITHUB_COPILOT_QUICK_CHAT.contextWindow,
    backgroundThinkingLevel: isGitHubCopilotThinkingLevel(r.backgroundThinkingLevel)
      ? r.backgroundThinkingLevel
      : DEFAULT_GITHUB_COPILOT_QUICK_CHAT.backgroundThinkingLevel,
    offeredModelIds: offered,
  };
}
