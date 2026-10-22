import type { CopilotSettings } from "@/settings/model";
import {
  backendDisplayOrder,
  backendNeedsSelfHostWarning,
  backendRegistry,
  getActiveBackendDescriptor,
  getCloudAgentIds,
  listBackendDescriptors,
  RECOMMENDED_BACKEND_ID,
} from "./registry";
import { ClaudeBackendDescriptor } from "./claude/descriptor";
import { CodexBackendDescriptor } from "./codex/descriptor";
import { GitHubCopilotBackendDescriptor } from "./github-copilot/descriptor";
import { OpencodeBackendDescriptor } from "./opencode/descriptor";

const GITHUB_COPILOT_ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

jest.mock("@/agentMode/backends/opencode/OpencodeInstallModal", () => ({
  OpencodeInstallModal: class {},
}));
jest.mock("@/agentMode/backends/github-copilot/GitHubCopilotInstallModal", () => ({
  GitHubCopilotInstallModal: class {},
}));
jest.mock("@/components/modals/ConfirmModal", () => ({ ConfirmModal: class {} }));
jest.mock("@/components/ui/setting-item", () => ({ SettingItem: () => null }));
jest.mock("@/components/ui/button", () => ({ Button: () => null }));
jest.mock("@/components/ui/input", () => ({ Input: () => null }));
jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));
jest.mock("obsidian", () => ({
  Modal: class {},
  Notice: class {},
  Platform: { isMobile: false },
}));

describe("registry", () => {
  const baseSettings = (activeBackend?: string, enableSelfHostMode = false): CopilotSettings =>
    ({
      enableSelfHostMode,
      agentMode: {
        enabled: true,
        byok: {},
        activeBackend: activeBackend ?? "opencode",
        backends: { opencode: {} },
      },
    }) as unknown as CopilotSettings;

  describe("getActiveBackendDescriptor()", () => {
    it("returns the explicitly selected OpenCode descriptor", () => {
      expect(getActiveBackendDescriptor(baseSettings())).toBe(OpencodeBackendDescriptor);
    });

    it(`returns GitHub Copilot when no backend has been chosen ${GITHUB_COPILOT_ISSUE}`, () => {
      const settings = { agentMode: { backends: {} } } as unknown as CopilotSettings;
      expect(getActiveBackendDescriptor(settings)).toBe(GitHubCopilotBackendDescriptor);
    });

    it("returns the selected cloud agent even while Self-Host Mode is on", () => {
      expect(getActiveBackendDescriptor(baseSettings("claude", true))).toBe(
        ClaudeBackendDescriptor
      );
      expect(getActiveBackendDescriptor(baseSettings("codex", true))).toBe(CodexBackendDescriptor);
      expect(getActiveBackendDescriptor(baseSettings("github-copilot", true))).toBe(
        GitHubCopilotBackendDescriptor
      );
    });

    it(`falls back to GitHub Copilot when an unknown backend is selected ${GITHUB_COPILOT_ISSUE}`, () => {
      expect(getActiveBackendDescriptor(baseSettings("nonexistent"))).toBe(
        GitHubCopilotBackendDescriptor
      );
      expect(getActiveBackendDescriptor(baseSettings("nonexistent", true))).toBe(
        GitHubCopilotBackendDescriptor
      );
    });
  });

  describe("listBackendDescriptors()", () => {
    it("lists every registered backend", () => {
      expect(listBackendDescriptors()).toEqual(
        expect.arrayContaining([
          GitHubCopilotBackendDescriptor,
          OpencodeBackendDescriptor,
          ClaudeBackendDescriptor,
          CodexBackendDescriptor,
        ])
      );
    });
  });

  describe("backendDisplayOrder()", () => {
    it(`lists GitHub Copilot first, then OpenCode, Claude and Codex ${GITHUB_COPILOT_ISSUE}`, () => {
      expect(backendDisplayOrder()).toEqual([
        GitHubCopilotBackendDescriptor,
        OpencodeBackendDescriptor,
        ClaudeBackendDescriptor,
        CodexBackendDescriptor,
      ]);
    });

    it("covers every registered backend exactly once", () => {
      const ids = backendDisplayOrder().map((descriptor) => descriptor.id);
      expect([...ids].sort()).toEqual(Object.keys(backendRegistry).sort());
    });

    it("returns a stable reference across calls", () => {
      expect(backendDisplayOrder()).toBe(backendDisplayOrder());
    });
  });

  describe("RECOMMENDED_BACKEND_ID", () => {
    it(`recommends GitHub Copilot, which needs no vendor service or API key ${GITHUB_COPILOT_ISSUE}`, () => {
      expect(RECOMMENDED_BACKEND_ID).toBe("github-copilot");
      expect(backendRegistry[RECOMMENDED_BACKEND_ID]).toBe(GitHubCopilotBackendDescriptor);
    });
  });

  describe("backendNeedsSelfHostWarning()", () => {
    it("never warns when Self-Host Mode is off", () => {
      const off = baseSettings("opencode", false);
      expect(backendNeedsSelfHostWarning(OpencodeBackendDescriptor, off)).toBe(false);
      expect(backendNeedsSelfHostWarning(ClaudeBackendDescriptor, off)).toBe(false);
      expect(backendNeedsSelfHostWarning(CodexBackendDescriptor, off)).toBe(false);
      expect(backendNeedsSelfHostWarning(GitHubCopilotBackendDescriptor, off)).toBe(false);
    });

    it("warns on cloud agents (Claude, Codex, GitHub Copilot) but not opencode when Self-Host Mode is on", () => {
      const on = baseSettings("opencode", true);
      expect(backendNeedsSelfHostWarning(OpencodeBackendDescriptor, on)).toBe(false);
      expect(backendNeedsSelfHostWarning(ClaudeBackendDescriptor, on)).toBe(true);
      expect(backendNeedsSelfHostWarning(CodexBackendDescriptor, on)).toBe(true);
      expect(backendNeedsSelfHostWarning(GitHubCopilotBackendDescriptor, on)).toBe(true);
    });
  });

  describe("getCloudAgentIds()", () => {
    it("contains exactly the non-self-hostable backends and returns the same set on every call", () => {
      const ids = getCloudAgentIds();
      expect([...ids].sort()).toEqual(["claude", "codex", "github-copilot"]);
      expect(getCloudAgentIds()).toBe(ids);
    });
  });
});
