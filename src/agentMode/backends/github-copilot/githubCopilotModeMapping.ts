import type { ModeMapping } from "@/agentMode/session/types";

export const GITHUB_COPILOT_AGENT_MODE_ID =
  "https://agentclientprotocol.com/protocol/session-modes#agent";

export function buildGitHubCopilotModeMapping(): ModeMapping {
  return {
    kind: "setMode",
    // Only Agent is offered. Autopilot turns on allow-all, so tool calls would skip Copilot's
    // permission prompt. Plan ends its turn without asking to approve the plan, so Copilot's
    // approve, revise and deny card never appears.
    // https://github.com/spectre009/obsidian-copilot/issues/2
    canonical: { default: GITHUB_COPILOT_AGENT_MODE_ID },
  };
}
