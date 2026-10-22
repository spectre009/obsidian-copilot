import type { GitHubCopilotSdkClient } from "./githubCopilotSdkClient";
import {
  setActiveGitHubCopilotChatModel,
  setGitHubCopilotSdkClient,
} from "./githubCopilotClientRegistry";
import { effectiveAutoCompactThreshold } from "./githubCopilotCompaction";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

const SONNET = {
  id: "claude-sonnet-5.5",
  capabilities: { limits: { max_prompt_tokens: 936000, max_context_window_tokens: 1000000 } },
  billing: {
    tokenPrices: { maxPromptTokens: 100000, longContext: { maxPromptTokens: 936000 } },
  },
};

function clientWith(model: unknown): GitHubCopilotSdkClient {
  return { getModel: jest.fn(async () => model) } as unknown as GitHubCopilotSdkClient;
}

function settings(contextWindow: "default" | "long_context" = "default") {
  return {
    autoCompactThreshold: 128000,
    githubCopilotQuickChat: {
      thinkingLevel: "default" as const,
      contextWindow,
      backgroundThinkingLevel: "low" as const,
      offeredModelIds: [],
    },
  };
}

describe("githubCopilotCompaction", () => {
  afterEach(() => {
    setGitHubCopilotSdkClient(null);
    setActiveGitHubCopilotChatModel(null);
  });

  describe("effectiveAutoCompactThreshold()", () => {
    it("keeps the setting when Quick Chat isn't using a GitHub Copilot model", async () => {
      setGitHubCopilotSdkClient(clientWith(SONNET));

      await expect(effectiveAutoCompactThreshold(settings())).resolves.toBe(128000);
    });

    it(`caps the setting to the GitHub Copilot model's default-tier prompt budget, for ${ISSUE}`, async () => {
      setGitHubCopilotSdkClient(clientWith(SONNET));
      setActiveGitHubCopilotChatModel("claude-sonnet-5.5");

      await expect(effectiveAutoCompactThreshold(settings())).resolves.toBe(100000);
    });

    it(`uses the long-context budget when long context applies, never exceeding the setting, for ${ISSUE}`, async () => {
      setGitHubCopilotSdkClient(clientWith(SONNET));
      setActiveGitHubCopilotChatModel("claude-sonnet-5.5");

      await expect(effectiveAutoCompactThreshold(settings("long_context"))).resolves.toBe(128000);
    });

    it("keeps the setting when the model's metadata can't be read", async () => {
      setGitHubCopilotSdkClient({
        getModel: jest.fn(async () => {
          throw new Error("CLI stopped");
        }),
      } as unknown as GitHubCopilotSdkClient);
      setActiveGitHubCopilotChatModel("claude-sonnet-5.5");

      await expect(effectiveAutoCompactThreshold(settings())).resolves.toBe(128000);
    });
  });
});
