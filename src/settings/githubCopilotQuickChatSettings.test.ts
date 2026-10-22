import {
  DEFAULT_GITHUB_COPILOT_QUICK_CHAT,
  isGitHubCopilotContextWindow,
  isGitHubCopilotThinkingLevel,
  sanitizeGitHubCopilotQuickChatSettings,
} from "./githubCopilotQuickChatSettings";

describe("githubCopilotQuickChatSettings", () => {
  describe("sanitizeGitHubCopilotQuickChatSettings()", () => {
    it("keeps valid stored values", () => {
      const stored = {
        thinkingLevel: "xhigh",
        contextWindow: "long_context",
        backgroundThinkingLevel: "default",
        offeredModelIds: ["claude-haiku-4.5"],
      };

      expect(sanitizeGitHubCopilotQuickChatSettings(stored)).toEqual(stored);
    });

    it("uses the defaults for a missing slice: model-default thinking, default window, low background thinking", () => {
      expect(sanitizeGitHubCopilotQuickChatSettings(undefined)).toBe(
        DEFAULT_GITHUB_COPILOT_QUICK_CHAT
      );
      expect(DEFAULT_GITHUB_COPILOT_QUICK_CHAT).toEqual({
        thinkingLevel: "default",
        contextWindow: "default",
        backgroundThinkingLevel: "low",
        offeredModelIds: [],
      });
    });

    it("repairs corrupt fields one by one without discarding the valid ones", () => {
      expect(
        sanitizeGitHubCopilotQuickChatSettings({
          thinkingLevel: "extreme",
          contextWindow: 3,
          backgroundThinkingLevel: "high",
          offeredModelIds: ["a", 7, ""],
        })
      ).toEqual({
        thinkingLevel: "default",
        contextWindow: "default",
        backgroundThinkingLevel: "high",
        offeredModelIds: ["a"],
      });
    });
  });

  describe("isGitHubCopilotThinkingLevel()", () => {
    it("accepts the CLI's effort levels and the model default only", () => {
      expect(isGitHubCopilotThinkingLevel("max")).toBe(true);
      expect(isGitHubCopilotThinkingLevel("minimal")).toBe(false);
    });
  });

  describe("isGitHubCopilotContextWindow()", () => {
    it("accepts the default and long-context tiers only", () => {
      expect(isGitHubCopilotContextWindow("long_context")).toBe(true);
      expect(isGitHubCopilotContextWindow("huge")).toBe(false);
    });
  });
});
