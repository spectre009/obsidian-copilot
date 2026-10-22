import { FileSystemAdapter, type App } from "obsidian";
import type { ModelManagementApi } from "@/modelManagement";
import type { CopilotSettings } from "@/settings/model";
import { subscribeToSettingsChange } from "@/settings/model";
import { isDesktopRuntime } from "@/utils/desktopRuntime";
import { getGitHubCopilotSdkClient } from "./githubCopilotClientRegistry";
import { refreshGitHubCopilotModels } from "./githubCopilotModelInventory";
import { startGitHubCopilotQuickChat } from "./githubCopilotQuickChat";
import { GitHubCopilotSdkClient } from "./githubCopilotSdkClient";

jest.mock("@/logger", () => ({ logInfo: jest.fn() }));
jest.mock("@/utils/desktopRuntime", () => ({ isDesktopRuntime: jest.fn(() => true) }));
jest.mock("@/settings/model", () => ({ subscribeToSettingsChange: jest.fn(() => jest.fn()) }));
jest.mock("@/agentMode", () => ({
  githubCopilotSdkLaunchKey: (settings: { launch: string }) => settings.launch,
  prepareGitHubCopilotSdkLaunch: jest.fn(async () => ({ binaryPath: "copilot" })),
}));
jest.mock("./githubCopilotModelInventory", () => ({
  refreshGitHubCopilotModels: jest.fn(async () => undefined),
  findGitHubCopilotProvider: (providers: Record<string, unknown>) => providers.copilot,
}));
jest.mock("./githubCopilotSdkClient", () => ({
  GitHubCopilotSdkClient: jest.fn().mockImplementation(() => ({
    listModels: jest.fn(async () => []),
    invalidate: jest.fn(),
    stop: jest.fn(async () => undefined),
  })),
}));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";
const API = {} as ModelManagementApi;

function vaultApp(): App {
  const adapter = Object.assign(new FileSystemAdapter(), { getBasePath: () => "C:\\vault" });
  return { vault: { adapter } } as unknown as App;
}

function settings(launch: string, hasCopilotProvider: boolean): CopilotSettings {
  return {
    launch,
    providers: hasCopilotProvider ? { copilot: {} } : {},
  } as unknown as CopilotSettings;
}

function settingsListener(): (prev: CopilotSettings, next: CopilotSettings) => void {
  return jest.mocked(subscribeToSettingsChange).mock.calls.at(-1)![0];
}

function createdClient(): jest.Mocked<GitHubCopilotSdkClient> {
  return jest.mocked(GitHubCopilotSdkClient).mock.results.at(-1)!
    .value as jest.Mocked<GitHubCopilotSdkClient>;
}

describe("githubCopilotQuickChat", () => {
  describe("startGitHubCopilotQuickChat()", () => {
    it(`publishes a client for the vault and reads the model list at startup, for ${ISSUE}`, async () => {
      await startGitHubCopilotQuickChat(vaultApp(), API, "4.0.15");

      expect(GitHubCopilotSdkClient).toHaveBeenCalledWith(
        expect.objectContaining({ clientVersion: "4.0.15" })
      );
      expect(getGitHubCopilotSdkClient()).toBe(createdClient());
      expect(refreshGitHubCopilotModels).toHaveBeenCalledWith(API, expect.any(Function));
    });

    it(`restarts the CLI when its launch settings change, for ${ISSUE}`, async () => {
      await startGitHubCopilotQuickChat(vaultApp(), API, "4.0.15");
      const client = createdClient();

      settingsListener()(settings("a", true), settings("a", true));
      expect(client.invalidate).not.toHaveBeenCalled();
      settingsListener()(settings("a", true), settings("b", true));
      expect(client.invalidate).toHaveBeenCalledWith("launch settings changed");
    });

    it(`rebuilds the inventory when Reset Settings removes the GitHub Copilot provider, for ${ISSUE}`, async () => {
      await startGitHubCopilotQuickChat(vaultApp(), API, "4.0.15");
      jest.mocked(refreshGitHubCopilotModels).mockClear();

      settingsListener()(settings("a", true), settings("a", false));

      expect(refreshGitHubCopilotModels).toHaveBeenCalledTimes(1);
    });

    it("stops the CLI and unpublishes the client on teardown", async () => {
      const stop = await startGitHubCopilotQuickChat(vaultApp(), API, "4.0.15");
      const client = createdClient();

      await stop();

      expect(client.stop).toHaveBeenCalledTimes(1);
      expect(getGitHubCopilotSdkClient()).toBeNull();
    });

    it(`starts nothing on mobile, for ${ISSUE}`, async () => {
      jest.mocked(GitHubCopilotSdkClient).mockClear();
      jest.mocked(isDesktopRuntime).mockReturnValueOnce(false);

      const stop = await startGitHubCopilotQuickChat(vaultApp(), API, "4.0.15");

      expect(GitHubCopilotSdkClient).not.toHaveBeenCalled();
      await expect(stop()).resolves.toBeUndefined();
    });
  });
});
