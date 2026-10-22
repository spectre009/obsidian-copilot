import {
  GITHUB_COPILOT_AGENT_MODE_ID,
  buildGitHubCopilotModeMapping,
} from "./githubCopilotModeMapping";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

describe("githubCopilotModeMapping", () => {
  describe("buildGitHubCopilotModeMapping()", () => {
    it(`maps Default to the CLI's Agent mode URI and offers neither Plan nor Autopilot ${ISSUE}`, () => {
      expect(buildGitHubCopilotModeMapping()).toEqual({
        kind: "setMode",
        canonical: { default: GITHUB_COPILOT_AGENT_MODE_ID },
      });
      expect(GITHUB_COPILOT_AGENT_MODE_ID).toBe(
        "https://agentclientprotocol.com/protocol/session-modes#agent"
      );
    });
  });
});
