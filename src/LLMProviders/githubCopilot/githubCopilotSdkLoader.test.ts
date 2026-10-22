import { isDesktopRuntime } from "@/utils/desktopRuntime";
import {
  GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE,
  loadGitHubCopilotSdk,
} from "./githubCopilotSdkLoader";

jest.mock("@/utils/desktopRuntime", () => ({ isDesktopRuntime: jest.fn(() => true) }));
jest.mock("@github/copilot-sdk", () => ({ CopilotClient: function CopilotClient() {} }));

describe("githubCopilotSdkLoader", () => {
  describe("loadGitHubCopilotSdk()", () => {
    it("imports the SDK once on desktop and reuses it", async () => {
      const first = await loadGitHubCopilotSdk();
      const second = await loadGitHubCopilotSdk();

      expect(typeof first.CopilotClient).toBe("function");
      expect(second).toBe(first);
    });

    it("refuses on mobile without importing the SDK, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
      jest.mocked(isDesktopRuntime).mockReturnValueOnce(false);

      await expect(loadGitHubCopilotSdk()).rejects.toThrow(GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE);
    });
  });
});
