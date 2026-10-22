import { renderHook } from "@testing-library/react";
import { useQuickChatModelCanCallTools } from "./useQuickChatModelCanCallTools";

let mockModelKey = "";
let mockEntries: unknown[] = [];

jest.mock("@/aiParams", () => ({
  useModelKey: () => [mockModelKey, jest.fn()],
}));
jest.mock("@/settings/model", () => ({ settingsStore: {} }));
jest.mock("jotai", () => ({
  ...jest.requireActual<object>("jotai"),
  useAtomValue: () => mockEntries,
}));
jest.mock("@/modelManagement", () => ({
  chatBackendPickerAtom: {},
  ...jest.requireActual<object>("@/modelManagement/chatModel/chatModelSelection"),
  ...jest.requireActual<object>("@/modelManagement/chatModel/configuredModelToCustomModel"),
}));

function entry(id: string, origin: Record<string, unknown>, catalogType = "anthropic") {
  return {
    configuredModelId: id,
    state: "ok",
    configuredModel: { configuredModelId: id, providerId: id, info: { id, displayName: id } },
    provider: { providerId: id, providerType: catalogType, displayName: id, origin, addedAt: 0 },
    needsSelfHostWarning: false,
  };
}

const COPILOT = entry(
  "copilot-haiku",
  { kind: "agent", agentType: "github-copilot" },
  "openai-compatible"
);
const BYOK = entry("byok-claude", { kind: "byok" });

describe("useQuickChatModelCanCallTools", () => {
  describe("useQuickChatModelCanCallTools()", () => {
    it("reports that a GitHub Copilot model can't call tools, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      mockEntries = [COPILOT, BYOK];
      mockModelKey = "copilot-haiku";

      expect(renderHook(() => useQuickChatModelCanCallTools()).result.current).toBe(false);
    });

    it("reports that a BYOK model can call tools", () => {
      mockEntries = [COPILOT, BYOK];
      mockModelKey = "byok-claude";

      expect(renderHook(() => useQuickChatModelCanCallTools()).result.current).toBe(true);
    });

    it("resolves a stale selection to the first enabled model, as the chat does", () => {
      mockEntries = [COPILOT, BYOK];
      mockModelKey = "removed-model";

      expect(renderHook(() => useQuickChatModelCanCallTools()).result.current).toBe(false);
    });
  });
});
