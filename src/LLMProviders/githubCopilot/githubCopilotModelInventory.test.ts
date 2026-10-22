import type { ModelInfo as SdkModelInfo } from "@github/copilot-sdk";
import type { ConfiguredModel, ModelInfo, ModelManagementApi, Provider } from "@/modelManagement";
import { getSettings, resetSettings } from "@/settings/model";
import {
  bootstrapGitHubCopilotModels,
  findGitHubCopilotProvider,
  refreshGitHubCopilotModels,
} from "./githubCopilotModelInventory";

jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

function sdkModel(id: string, policy?: "enabled" | "disabled"): SdkModelInfo {
  const model: SdkModelInfo = {
    id,
    name: id.toUpperCase(),
    capabilities: {
      supports: { vision: true, reasoningEffort: false },
      limits: { max_context_window_tokens: 128000 },
    },
  };
  return policy ? { ...model, policy: { state: policy, terms: "" } } : model;
}

function configured(wireId: string): ConfiguredModel {
  return {
    configuredModelId: `cm-${wireId}`,
    providerId: "copilot",
    info: { id: wireId, displayName: wireId },
    configuredAt: 0,
  };
}

function harness(inventory: string[]) {
  const enabled: string[] = [];
  const bootstrapAgentModels = jest.fn(async () => ({ providerId: "copilot", registered: true }));
  const api = {
    setup: { agent: { bootstrapAgentModels } },
    configuredModelRegistry: { listByProvider: () => inventory.map(configured) },
    backendConfigRegistry: {
      enableModel: jest.fn(async (_backend: string, id: string) => {
        enabled.push(id);
      }),
    },
  } as unknown as Pick<
    ModelManagementApi,
    "setup" | "configuredModelRegistry" | "backendConfigRegistry"
  >;
  return { api, enabled, bootstrapAgentModels };
}

describe("githubCopilotModelInventory", () => {
  beforeEach(() => {
    resetSettings();
  });

  describe("bootstrapGitHubCopilotModels()", () => {
    it(`seeds the shared GitHub Copilot inventory with the CLI's models and their metadata, skipping models the policy disables, for ${ISSUE}`, async () => {
      const h = harness(["claude-haiku-4.5", "gpt-6.1-sol"]);

      await bootstrapGitHubCopilotModels(h.api, [
        sdkModel("claude-haiku-4.5", "enabled"),
        sdkModel("gpt-6.1-sol"),
        sdkModel("blocked-model", "disabled"),
      ]);

      const [input] = h.bootstrapAgentModels.mock.calls[0] as unknown as [
        { agentType: string; providerType: string; displayName: string; models: ModelInfo[] },
      ];
      expect(input.agentType).toBe("github-copilot");
      expect(input.providerType).toBe("openai-compatible");
      expect(input.displayName).toBe("GitHub Copilot");
      expect(input.models.map((model) => model.id)).toEqual(["claude-haiku-4.5", "gpt-6.1-sol"]);
      expect(input.models[0].limits?.context).toBe(128000);
    });

    it(`enrolls the inventory's models in Quick Chat and records them, for ${ISSUE}`, async () => {
      const h = harness(["claude-haiku-4.5", "gpt-6.1-sol"]);

      await bootstrapGitHubCopilotModels(h.api, [sdkModel("claude-haiku-4.5")]);

      expect(h.enabled).toEqual(["cm-claude-haiku-4.5", "cm-gpt-6.1-sol"]);
      expect(getSettings().githubCopilotQuickChat.offeredModelIds).toEqual([
        "claude-haiku-4.5",
        "gpt-6.1-sol",
      ]);
    });

    it(`enrolls each model only once, so a model the user turned off stays off, for ${ISSUE}`, async () => {
      const h = harness(["claude-haiku-4.5"]);
      await bootstrapGitHubCopilotModels(h.api, [sdkModel("claude-haiku-4.5")]);
      h.enabled.length = 0;

      await bootstrapGitHubCopilotModels(h.api, [sdkModel("claude-haiku-4.5")]);

      expect(h.enabled).toEqual([]);
    });

    it("does nothing for an empty model list", async () => {
      const h = harness([]);

      await bootstrapGitHubCopilotModels(h.api, []);

      expect(h.bootstrapAgentModels).not.toHaveBeenCalled();
    });
  });

  describe("refreshGitHubCopilotModels()", () => {
    it(`logs instead of throwing when the CLI can't list models, so startup continues, for ${ISSUE}`, async () => {
      const h = harness([]);

      await expect(
        refreshGitHubCopilotModels(h.api, async () => {
          throw new Error("GitHub Copilot CLI not found.");
        })
      ).resolves.toBeUndefined();
      expect(h.bootstrapAgentModels).not.toHaveBeenCalled();
    });
  });

  describe("findGitHubCopilotProvider()", () => {
    it("finds the GitHub Copilot agent provider and ignores other agents' providers", () => {
      const copilot: Provider = {
        providerId: "copilot",
        providerType: "openai-compatible",
        displayName: "GitHub Copilot",
        origin: { kind: "agent", agentType: "github-copilot" },
        addedAt: 0,
      };
      const codex: Provider = {
        ...copilot,
        providerId: "codex",
        origin: { kind: "agent", agentType: "codex" },
      };

      expect(findGitHubCopilotProvider({ codex, copilot })).toBe(copilot);
      expect(findGitHubCopilotProvider({ codex })).toBeUndefined();
    });
  });
});
