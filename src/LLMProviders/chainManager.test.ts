import {
  AutonomousAgentChainRunner,
  CopilotPlusChainRunner,
} from "@/LLMProviders/chainRunner/index";
import type { ModelManagementApi } from "@/modelManagement";
import { getSettings } from "@/settings/model";
import type { ChatMessage } from "@/types/message";
import type { App } from "obsidian";
import { getBackgroundChatModel } from "./backgroundChatModel";
import ChainManager from "./chainManager";

const mockChatModelManager = {
  getChatModel: jest.fn(),
  validateChatModel: jest.fn(() => true),
  setChatModelFromBridged: jest.fn(async () => undefined),
};

jest.mock("@/logger", () => ({ logError: jest.fn(), logInfo: jest.fn() }));
jest.mock("@/aiParams", () => ({
  getChainType: jest.fn(() => "copilot_plus"),
  getModelKey: jest.fn(() => ""),
}));
jest.mock("@/settings/model", () => ({
  getSettings: jest.fn(() => ({ enableAutonomousAgent: true })),
  subscribeToSettingsChange: jest.fn(),
}));
jest.mock("@/modelManagement", () => ({
  resolveChatBackendModel: jest.fn(async () => ({ ok: false, reason: "empty" })),
}));
jest.mock("./chatModelManager", () => ({
  __esModule: true,
  default: { getInstance: () => mockChatModelManager },
}));
jest.mock("./memoryManager", () => ({
  __esModule: true,
  default: { getInstance: () => ({}) },
}));
jest.mock("@/memory/UserMemoryManager", () => ({ UserMemoryManager: jest.fn() }));
jest.mock("./backgroundChatModel", () => ({ getBackgroundChatModel: jest.fn() }));
jest.mock("@/LLMProviders/chainRunner/index", () => {
  const runner = () => jest.fn().mockImplementation(() => ({ run: jest.fn(async () => "answer") }));
  return {
    LLMChainRunner: runner(),
    CopilotPlusChainRunner: runner(),
    AutonomousAgentChainRunner: runner(),
  };
});

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

const MODEL_MANAGEMENT = {
  providerRegistry: { subscribe: jest.fn() },
  backendConfigRegistry: { subscribe: jest.fn() },
} as unknown as ModelManagementApi;

function createManager(): ChainManager {
  return new ChainManager({} as App, MODEL_MANAGEMENT);
}

function run(manager: ChainManager) {
  return manager.runChain(
    { message: "hi" } as ChatMessage,
    new AbortController(),
    jest.fn(),
    jest.fn()
  );
}

describe("chainManager", () => {
  describe("ChainManager", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe("runChain()", () => {
      it(`runs vault chat's automatic retrieval for a model that can't call tools, even with the agent setting on, for ${ISSUE}`, async () => {
        mockChatModelManager.getChatModel.mockReturnValue({});
        const manager = createManager();

        await run(manager);

        expect(CopilotPlusChainRunner).toHaveBeenCalledTimes(1);
        expect(AutonomousAgentChainRunner).not.toHaveBeenCalled();
      });

      it("runs the autonomous agent for a model that can call tools", async () => {
        mockChatModelManager.getChatModel.mockReturnValue({ bindTools: jest.fn() });
        const manager = createManager();

        await run(manager);

        expect(AutonomousAgentChainRunner).toHaveBeenCalledTimes(1);
      });

      it("runs automatic retrieval when the agent setting is off", async () => {
        jest.mocked(getSettings).mockReturnValue({ enableAutonomousAgent: false } as never);
        mockChatModelManager.getChatModel.mockReturnValue({ bindTools: jest.fn() });
        const manager = createManager();

        await run(manager);

        expect(CopilotPlusChainRunner).toHaveBeenCalledTimes(1);
      });
    });

    describe("getBackgroundChatModel()", () => {
      it(`resolves the background model with this chain's model management and chat model factory, for ${ISSUE}`, async () => {
        const background = { name: "background" };
        jest.mocked(getBackgroundChatModel).mockResolvedValue(background as never);
        const manager = createManager();

        await expect(manager.getBackgroundChatModel()).resolves.toBe(background);
        expect(getBackgroundChatModel).toHaveBeenCalledWith({
          modelManagement: MODEL_MANAGEMENT,
          chatModelManager: mockChatModelManager,
        });
      });
    });
  });
});
