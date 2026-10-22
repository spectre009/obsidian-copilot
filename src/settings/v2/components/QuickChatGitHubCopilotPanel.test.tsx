import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { setSettings, updateSetting } from "@/settings/model";
import { QuickChatGitHubCopilotPanel } from "./QuickChatGitHubCopilotPanel";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

let mockSettings: Record<string, unknown>;
let mockModelKey: string;

jest.mock("@/aiParams", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useModelKey: () => [mockModelKey, jest.fn()],
}));
jest.mock("@/settings/model", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useSettingsValue: () => mockSettings,
  settingsStore: {},
  setSettings: jest.fn(),
  updateSetting: jest.fn(),
}));
jest.mock("jotai", () => ({
  ...jest.requireActual<object>("jotai"),
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useAtomValue: () => mockEntries,
}));
jest.mock("@/modelManagement", () => ({
  chatBackendPickerAtom: {},
  ...jest.requireActual<object>("@/modelManagement/chatModel/chatModelSelection"),
  ...jest.requireActual<object>("@/modelManagement/chatModel/configuredModelToCustomModel"),
}));
jest.mock("@/hooks/useChatBackendModelOptions", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useChatBackendModelOptions: () => ({
    options: [
      { label: "Claude Haiku 4.5", value: "haiku-id" },
      { label: "Claude Sonnet 5.5", value: "sonnet-id" },
    ],
    resolveSelectionId: (selection: string) =>
      selection === "claude-haiku-4.5|github-copilot" ? "haiku-id" : undefined,
  }),
}));
jest.mock("@/hooks/useGitHubCopilotQuickChatStatus", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useGitHubCopilotAccount: () => ({ kind: "signed-in", login: "octocat" }),
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useGitHubCopilotModel: (id: string | undefined) =>
    id
      ? {
          id,
          capabilities: { limits: { max_context_window_tokens: 200000 } },
        }
      : undefined,
}));

let mockEntries: unknown[] = [];

const COPILOT_ENTRY = {
  configuredModelId: "sonnet-id",
  state: "ok",
  configuredModel: {
    configuredModelId: "sonnet-id",
    providerId: "copilot",
    info: { id: "claude-sonnet-5.5", displayName: "Claude Sonnet 5.5" },
    configuredAt: 0,
  },
  provider: {
    providerId: "copilot",
    providerType: "openai-compatible",
    displayName: "GitHub Copilot",
    origin: { kind: "agent", agentType: "github-copilot" },
    addedAt: 0,
  },
  needsSelfHostWarning: false,
};

const BYOK_ENTRY = {
  ...COPILOT_ENTRY,
  configuredModelId: "byok-id",
  configuredModel: {
    configuredModelId: "byok-id",
    providerId: "anthropic",
    info: { id: "claude-sonnet-4", displayName: "Claude Sonnet 4" },
    configuredAt: 0,
  },
  provider: {
    providerId: "anthropic",
    providerType: "anthropic",
    displayName: "Anthropic",
    origin: { kind: "user" },
    addedAt: 0,
  },
};

describe("QuickChatGitHubCopilotPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntries = [COPILOT_ENTRY, BYOK_ENTRY];
    mockModelKey = "sonnet-id";
    mockSettings = {
      defaultModelKey: "byok-id",
      backgroundModelKey: "claude-haiku-4.5|github-copilot",
      githubCopilotQuickChat: {
        thinkingLevel: "default",
        contextWindow: "default",
        backgroundThinkingLevel: "low",
        offeredModelIds: [],
      },
    };
  });

  describe("QuickChatGitHubCopilotPanel()", () => {
    it(`shows the default background model, the account and the window of the model selected in Quick Chat rather than the default model, for ${ISSUE}`, () => {
      render(<QuickChatGitHubCopilotPanel />);

      expect(screen.getByDisplayValue("Claude Haiku 4.5")).toBeTruthy();
      expect(screen.getByText("octocat")).toBeTruthy();
      expect(screen.getByText(/Claude Sonnet 5\.5: 200,000 prompt tokens\./)).toBeTruthy();
    });

    it(`shows "Same as chat model" when the background model isn't enabled, and stores an empty key when picked, for ${ISSUE}`, () => {
      mockSettings.backgroundModelKey = "gone|github-copilot";
      render(<QuickChatGitHubCopilotPanel />);

      expect(screen.getByDisplayValue("Same as chat model")).toBeTruthy();
      fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "sonnet-id" } });
      expect(updateSetting).toHaveBeenCalledWith("backgroundModelKey", "sonnet-id");

      fireEvent.change(screen.getAllByRole("combobox")[0], {
        target: { value: "__same_as_chat_model__" },
      });
      expect(updateSetting).toHaveBeenCalledWith("backgroundModelKey", "");
    });

    it("saves thinking levels and the context window into the GitHub Copilot settings slice", () => {
      render(<QuickChatGitHubCopilotPanel />);
      const [, backgroundThinking, thinking, context] = screen.getAllByRole("combobox");

      fireEvent.change(backgroundThinking, { target: { value: "medium" } });
      fireEvent.change(thinking, { target: { value: "high" } });
      fireEvent.change(context, { target: { value: "long_context" } });

      const updates = jest
        .mocked(setSettings)
        .mock.calls.map(([update]) =>
          (update as (current: typeof mockSettings) => Record<string, unknown>)(mockSettings)
        );
      expect(updates.map((u) => u.githubCopilotQuickChat)).toEqual([
        expect.objectContaining({ backgroundThinkingLevel: "medium" }),
        expect.objectContaining({ thinkingLevel: "high" }),
        expect.objectContaining({ contextWindow: "long_context" }),
      ]);
    });

    it("leaves out the window details when the selected model isn't a GitHub Copilot model", () => {
      mockModelKey = "byok-id";
      render(<QuickChatGitHubCopilotPanel />);

      expect(screen.queryByText(/tokens\./)).toBeNull();
    });
  });
});
