import type * as CopilotSdk from "@github/copilot-sdk";
import { isDesktopRuntime } from "@/utils/desktopRuntime";

export type GitHubCopilotSdk = typeof CopilotSdk;

export const GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE =
  "GitHub Copilot models need the Obsidian desktop app.";

let pending: Promise<GitHubCopilotSdk> | null = null;

/**
 * Loads the GitHub Copilot SDK on first use. The SDK drives the Copilot CLI as a child process,
 * so it is imported lazily and only on desktop, which keeps it off the mobile load path.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
export function loadGitHubCopilotSdk(): Promise<GitHubCopilotSdk> {
  if (!isDesktopRuntime()) return Promise.reject(new Error(GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE));
  pending ??= import("@github/copilot-sdk").catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}
