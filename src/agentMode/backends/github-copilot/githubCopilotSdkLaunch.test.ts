import * as os from "node:os";
import * as path from "node:path";
import { getSettings, resetSettings, setSettings } from "@/settings/model";
import { githubCopilotLaunch } from "./descriptor";
import { GITHUB_COPILOT_NOT_FOUND_MESSAGE } from "./GitHubCopilotBackend";
import { githubCopilotHomeDir } from "./githubCopilotHome";
import {
  GITHUB_COPILOT_QUICK_CHAT_HOME,
  githubCopilotSdkLaunchKey,
  prepareGitHubCopilotSdkLaunch,
} from "./githubCopilotSdkLaunch";

jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));
jest.mock("./descriptor", () => ({
  githubCopilotLaunch: {
    resolveBinary: jest.fn(() => "/bin/copilot"),
    assertCompatible: jest.fn(async () => undefined),
  },
}));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

describe("githubCopilotSdkLaunch", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetSettings();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe("prepareGitHubCopilotSdkLaunch()", () => {
    it(`starts the agent's CLI with a Quick Chat home inside the vault's Copilot home and the agent's environment rules, for ${ISSUE}`, async () => {
      process.env.COPILOT_ALLOW_ALL = "true";
      const makeDirectory = jest.fn(async () => undefined);

      const spec = await prepareGitHubCopilotSdkLaunch("/vaults/Work", makeDirectory);

      const home = path.join(
        githubCopilotHomeDir(os.homedir(), "/vaults/Work"),
        GITHUB_COPILOT_QUICK_CHAT_HOME
      );
      expect(spec.binaryPath).toBe("/bin/copilot");
      expect(spec.homeDir).toBe(home);
      expect(makeDirectory).toHaveBeenCalledWith(home, { recursive: true });
      expect(spec.env.COPILOT_HOME).toBe(home);
      expect(spec.env.COPILOT_AUTO_UPDATE).toBe("false");
      expect(spec.env.COPILOT_ALLOW_ALL).toBeUndefined();
      expect(Object.values(spec.env).every((value) => typeof value === "string")).toBe(true);
      expect(githubCopilotLaunch.assertCompatible).toHaveBeenCalledWith(
        "/bin/copilot",
        expect.objectContaining({ COPILOT_HOME: home })
      );
    });

    it("explains how to install the CLI when none is found", async () => {
      jest.mocked(githubCopilotLaunch.resolveBinary).mockReturnValueOnce(null);

      await expect(prepareGitHubCopilotSdkLaunch("/vaults/Work", jest.fn())).rejects.toThrow(
        GITHUB_COPILOT_NOT_FOUND_MESSAGE
      );
      expect(githubCopilotLaunch.assertCompatible).not.toHaveBeenCalled();
    });
  });

  describe("githubCopilotSdkLaunchKey()", () => {
    it(`changes with the CLI path, environment overrides or vendor blocking, and not with unrelated settings, for ${ISSUE}`, () => {
      const base = githubCopilotSdkLaunchKey(getSettings());

      setSettings({ debug: !getSettings().debug });
      expect(githubCopilotSdkLaunchKey(getSettings())).toBe(base);

      setSettings((cur) => ({
        agentMode: {
          ...cur.agentMode,
          backends: { "github-copilot": { envOverrides: { HTTPS_PROXY: "http://proxy" } } },
        },
      }));
      const withProxy = githubCopilotSdkLaunchKey(getSettings());
      expect(withProxy).not.toBe(base);

      setSettings({ blockVendorServices: false });
      expect(githubCopilotSdkLaunchKey(getSettings())).not.toBe(withProxy);
    });
  });
});
