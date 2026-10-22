import {
  githubCopilotInstallCommand,
  validateGitHubCopilotCliPath,
} from "./GitHubCopilotInstallModal";
import { validateExecutableFile } from "@/utils/detectBinary";

jest.mock("@/utils/detectBinary", () => ({ validateExecutableFile: jest.fn(async () => null) }));
jest.mock("./descriptor", () => ({}));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

describe("GitHubCopilotInstallModal", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("githubCopilotInstallCommand()", () => {
    it.each([
      ["win32", "winget install GitHub.Copilot"],
      ["darwin", "brew install --cask copilot-cli"],
      ["linux", "curl -fsSL https://gh.io/copilot-install | bash"],
    ] as const)("names the official installer for %s", (platform, command) => {
      expect(githubCopilotInstallCommand(platform)).toBe(command);
    });
  });

  describe("validateGitHubCopilotCliPath()", () => {
    it(`rejects npm's Windows launchers before touching the disk ${ISSUE}`, async () => {
      await expect(
        validateGitHubCopilotCliPath("C:\\Users\\me\\AppData\\Roaming\\npm\\copilot.cmd", "win32")
      ).resolves.toMatch(/copilot\.exe/);
      expect(validateExecutableFile).not.toHaveBeenCalled();
    });

    it("accepts an existing native executable", async () => {
      await expect(
        validateGitHubCopilotCliPath("C:\\cli\\copilot.exe", "win32")
      ).resolves.toBeNull();
      expect(validateExecutableFile).toHaveBeenCalledWith("C:\\cli\\copilot.exe");
    });

    it("reports a missing file", async () => {
      jest.mocked(validateExecutableFile).mockResolvedValueOnce("No file at /nope.");

      await expect(validateGitHubCopilotCliPath("/nope", "darwin")).resolves.toBe(
        "No file at /nope."
      );
    });
  });
});
