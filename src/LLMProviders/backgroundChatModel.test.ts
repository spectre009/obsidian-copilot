import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatModelProviders } from "@/constants";
import type { EnabledBackendEntry, ModelManagementApi, Provider } from "@/modelManagement";
import { getBackgroundChatModel, type BackgroundChatModelDeps } from "./backgroundChatModel";

jest.mock("@/logger", () => ({ logWarn: jest.fn() }));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

const COPILOT_PROVIDER: Provider = {
  providerId: "copilot",
  providerType: "openai-compatible",
  displayName: "GitHub Copilot",
  origin: { kind: "agent", agentType: "github-copilot" },
  addedAt: 0,
};

const HAIKU_ENTRY: EnabledBackendEntry = {
  configuredModelId: "haiku-id",
  state: "ok",
  configuredModel: {
    configuredModelId: "haiku-id",
    providerId: "copilot",
    info: { id: "claude-haiku-4.5", displayName: "Claude Haiku 4.5" },
    configuredAt: 0,
  },
  provider: COPILOT_PROVIDER,
  needsSelfHostWarning: false,
};

function deps(backgroundModelKey: string, entries: EnabledBackendEntry[] = [HAIKU_ENTRY]) {
  const chatModel = { name: "chat" } as unknown as BaseChatModel;
  const backgroundModel = { name: "background" } as unknown as BaseChatModel;
  const createModelInstanceFromBridged = jest.fn(async () => backgroundModel);
  const value: BackgroundChatModelDeps = {
    modelManagement: {
      backendConfigRegistry: { resolveEnabled: () => entries },
      providerRegistry: { getApiKey: async () => null },
    } as unknown as Pick<ModelManagementApi, "backendConfigRegistry" | "providerRegistry">,
    chatModelManager: { getChatModel: () => chatModel, createModelInstanceFromBridged },
    settings: {
      backgroundModelKey,
      githubCopilotQuickChat: {
        thinkingLevel: "default",
        contextWindow: "default",
        backgroundThinkingLevel: "low",
        offeredModelIds: [],
      },
    },
  };
  return { value, chatModel, backgroundModel, createModelInstanceFromBridged };
}

describe("backgroundChatModel", () => {
  describe("getBackgroundChatModel()", () => {
    it(`builds the configured background model with the background thinking level, for ${ISSUE}`, async () => {
      const d = deps("claude-haiku-4.5|github-copilot");

      await expect(getBackgroundChatModel(d.value)).resolves.toBe(d.backgroundModel);
      expect(d.createModelInstanceFromBridged).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "claude-haiku-4.5",
          provider: ChatModelProviders.GITHUB_COPILOT,
        }),
        { githubCopilotThinkingLevel: "low" }
      );
    });

    it(`uses the chat model when set to "Same as chat model", for ${ISSUE}`, async () => {
      const d = deps("");

      await expect(getBackgroundChatModel(d.value)).resolves.toBe(d.chatModel);
      expect(d.createModelInstanceFromBridged).not.toHaveBeenCalled();
    });

    it(`falls back to the chat model when the background model isn't enabled in Quick Chat, for ${ISSUE}`, async () => {
      const d = deps("claude-haiku-4.5|github-copilot", []);

      await expect(getBackgroundChatModel(d.value)).resolves.toBe(d.chatModel);
    });

    it(`falls back to the chat model when building the background model fails, for ${ISSUE}`, async () => {
      const d = deps("haiku-id");
      d.createModelInstanceFromBridged.mockRejectedValueOnce(new Error("no key"));

      await expect(getBackgroundChatModel(d.value)).resolves.toBe(d.chatModel);
    });
  });
});
