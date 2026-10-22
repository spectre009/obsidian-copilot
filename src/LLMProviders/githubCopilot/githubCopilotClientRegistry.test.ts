import type { GitHubCopilotSdkClient } from "./githubCopilotSdkClient";
import {
  getActiveGitHubCopilotChatModel,
  getGitHubCopilotSdkClient,
  setActiveGitHubCopilotChatModel,
  setGitHubCopilotSdkClient,
} from "./githubCopilotClientRegistry";

describe("githubCopilotClientRegistry", () => {
  afterEach(() => {
    setGitHubCopilotSdkClient(null);
    setActiveGitHubCopilotChatModel(null);
  });

  describe("setGitHubCopilotSdkClient()", () => {
    it("publishes the running client to getGitHubCopilotSdkClient until it is cleared", () => {
      const client = {} as GitHubCopilotSdkClient;

      expect(getGitHubCopilotSdkClient()).toBeNull();
      setGitHubCopilotSdkClient(client);
      expect(getGitHubCopilotSdkClient()).toBe(client);
    });
  });

  describe("setActiveGitHubCopilotChatModel()", () => {
    it("records the GitHub Copilot model Quick Chat uses, or null for other providers", () => {
      setActiveGitHubCopilotChatModel("claude-haiku-4.5");
      expect(getActiveGitHubCopilotChatModel()).toBe("claude-haiku-4.5");

      setActiveGitHubCopilotChatModel(null);
      expect(getActiveGitHubCopilotChatModel()).toBeNull();
    });
  });
});
