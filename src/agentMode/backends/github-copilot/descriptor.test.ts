import * as fs from "node:fs";
import * as path from "node:path";
import { acpStateToBackendState } from "@/agentMode/acp/wireTranslate";
import type { BackendState, ModelSelectionSession } from "@/agentMode/session/types";
import { resetSettings, type CopilotSettings } from "@/settings/model";
import {
  GitHubCopilotBackendDescriptor,
  githubCopilotLaunch,
  githubCopilotSignInCommand,
  getGitHubCopilotInstallState,
  refreshGitHubCopilotInstallState,
  resolveGitHubCopilotCliPath,
} from "./descriptor";
import { resolveGitHubCopilotBinary } from "./githubCopilotBinaryResolver";
import { GITHUB_COPILOT_AGENT_MODE_ID } from "./githubCopilotModeMapping";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

const mockRunVersion = jest.fn();

jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));
jest.mock("./GitHubCopilotInstallModal", () => ({ GitHubCopilotInstallModal: class {} }));
jest.mock("./GitHubCopilotSettingsPanel", () => ({ GitHubCopilotSettingsPanel: () => null }));
jest.mock("./githubCopilotBinaryResolver", () => ({
  ...jest.requireActual("./githubCopilotBinaryResolver"),
  resolveGitHubCopilotBinary: jest.fn(),
  githubCopilotSearchDirs: jest.fn(() => []),
}));
jest.mock("./githubCopilotVersion", () => {
  const actual = jest.requireActual("./githubCopilotVersion");
  return {
    ...actual,
    GitHubCopilotCompatibilityStore: class extends actual.GitHubCopilotCompatibilityStore {
      constructor() {
        super((...args: unknown[]) => mockRunVersion(...args));
      }
    },
  };
});

const resolveBinary = jest.mocked(resolveGitHubCopilotBinary);

interface Handshake {
  sessionNew: { modes: unknown; configOptions: unknown };
}

const HANDSHAKE: Handshake = JSON.parse(
  fs.readFileSync(path.join(__dirname, "__fixtures__", "acpHandshake.json"), "utf8")
);

function handshakeState(): BackendState {
  return acpStateToBackendState(
    HANDSHAKE.sessionNew.modes as Parameters<typeof acpStateToBackendState>[0],
    HANDSHAKE.sessionNew.configOptions as Parameters<typeof acpStateToBackendState>[1],
    GitHubCopilotBackendDescriptor
  );
}

// Copilot's config options carry reasoning-effort levels only for the selected model, so switching
// models refreshes the catalog. https://github.com/spectre009/obsidian-copilot/issues/2
function fakeSession(initial: BackendState, effortsAfterSwitch: Record<string, string[]> = {}) {
  let state = initial;
  const calls: string[] = [];
  const session: ModelSelectionSession = {
    getState: () => state,
    applyModelWireId: jest.fn(async (wireId: string) => {
      calls.push(`model ${wireId}`);
      const efforts = (effortsAfterSwitch[wireId] ?? []).map((value) => ({ value, label: value }));
      state = {
        ...state,
        model: {
          ...state.model!,
          current: { baseModelId: wireId, effort: null },
          availableModels: state.model!.availableModels.map((m) =>
            m.baseModelId === wireId ? { ...m, effortOptions: efforts } : m
          ),
        },
      };
    }),
    setConfigOption: jest.fn(async (configId: string, value: string) => {
      calls.push(`${configId} ${value}`);
    }),
  };
  return { session, calls };
}

function settingsWith(githubCopilot: Record<string, unknown>): CopilotSettings {
  return {
    agentMode: { backends: { "github-copilot": githubCopilot } },
  } as unknown as CopilotSettings;
}

describe("descriptor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSettings();
  });

  describe("GitHubCopilotBackendDescriptor", () => {
    describe("wire", () => {
      it(`encodes a selection as the bare model id, since effort is a separate option ${ISSUE}`, () => {
        expect(
          GitHubCopilotBackendDescriptor.wire.encode({ baseModelId: "gpt-5.5", effort: "high" })
        ).toBe("gpt-5.5");
      });

      it("decodes a model id with no effort and no single provider", () => {
        expect(GitHubCopilotBackendDescriptor.wire.decode("claude-sonnet-5.5")).toEqual({
          selection: { baseModelId: "claude-sonnet-5.5", effort: null },
          provider: null,
        });
      });
    });

    describe("captured CLI handshake", () => {
      it(`offers every advertised model and the current one's reasoning efforts ${ISSUE}`, () => {
        const model = handshakeState().model!;

        expect(model.availableModels).toHaveLength(17);
        expect(model.availableModels.map((m) => m.baseModelId)).toEqual(
          expect.arrayContaining(["auto", "claude-sonnet-5.5", "gpt-5.6-sol", "grok-4.7"])
        );
        expect(model.current).toEqual({ baseModelId: "claude-sonnet-5.5", effort: "medium" });
        expect(model.apply).toEqual({
          kind: "setConfigOption",
          configId: "model",
          effortConfigId: "reasoning_effort",
        });
        expect(
          model.availableModels.find((m) => m.baseModelId === "claude-sonnet-5.5")?.effortOptions
        ).toEqual([
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
          { value: "xhigh", label: "xhigh" },
          { value: "max", label: "max" },
        ]);
      });

      it(`offers only Agent mode, hiding Plan and Autopilot ${ISSUE}`, () => {
        expect(handshakeState().mode).toEqual({
          current: "default",
          options: [{ value: "default", label: "Default" }],
          apply: { default: { kind: "setMode", nativeId: GITHUB_COPILOT_AGENT_MODE_ID } },
        });
      });

      it("surfaces nothing from the allow-all switch or other unknown config categories", () => {
        const state = handshakeState();

        expect(Object.keys(state).sort()).toEqual(["mode", "model"]);
        expect(state.model!.availableModels.map((m) => m.name)).not.toContain("Allow All");
      });
    });

    describe("applySelection()", () => {
      it(`switches the model before the effort, so effort applies to the new model's catalog ${ISSUE}`, async () => {
        const { session, calls } = fakeSession(handshakeState(), {
          "claude-opus-5.5": ["low", "medium", "high"],
        });

        await GitHubCopilotBackendDescriptor.applySelection(session, {
          baseModelId: "claude-opus-5.5",
          effort: "high",
        });

        expect(calls).toEqual(["model claude-opus-5.5", "reasoning_effort high"]);
      });

      it("changes only the effort when the model is already selected", async () => {
        const { session, calls } = fakeSession(handshakeState());

        await GitHubCopilotBackendDescriptor.applySelection(session, {
          baseModelId: "claude-sonnet-5.5",
          effort: "max",
        });

        expect(calls).toEqual(["reasoning_effort max"]);
      });

      it("sends no effort for a model that offers none", async () => {
        const { session, calls } = fakeSession(handshakeState());

        await GitHubCopilotBackendDescriptor.applySelection(session, {
          baseModelId: "auto",
          effort: "high",
        });

        expect(calls).toEqual(["model auto"]);
      });
    });

    describe("getEnabledModelEntries()", () => {
      it("lists the enabled models discovered for GitHub Copilot, which the picker needs to show it", () => {
        const settings = {
          backends: { "github-copilot": { enabledModels: ["cm-sonnet"] } },
          configuredModels: [
            {
              configuredModelId: "cm-sonnet",
              providerId: "agent-github-copilot",
              configuredAt: 0,
              info: { id: "claude-sonnet-5.5", displayName: "Claude Sonnet 5.5" },
            },
          ],
        } as unknown as CopilotSettings;

        expect(GitHubCopilotBackendDescriptor.getEnabledModelEntries!(settings)).toEqual([
          expect.objectContaining({
            baseModelId: "claude-sonnet-5.5",
            name: "Claude Sonnet 5.5",
            credentialState: "ok",
          }),
        ]);
      });
    });

    describe("dataDestination()", () => {
      it("names GitHub Copilot as where prompts go", () => {
        expect(GitHubCopilotBackendDescriptor.dataDestination!(settingsWith({}), null)).toEqual({
          kind: "cloud",
          label: "GitHub Copilot",
        });
      });
    });

    describe("getInstallState()", () => {
      it("is absent when no CLI is installed", () => {
        resolveBinary.mockReturnValue(null);

        expect(GitHubCopilotBackendDescriptor.getInstallState(settingsWith({}))).toEqual({
          kind: "absent",
        });
      });
    });
  });

  describe("getGitHubCopilotInstallState()", () => {
    it("is checking until the found CLI's version is known, then ready, without probing on read", async () => {
      resolveBinary.mockReturnValue("/found/copilot-a");
      mockRunVersion.mockResolvedValue({ stdout: "GitHub Copilot CLI 1.0.102-1.\n" });

      expect(getGitHubCopilotInstallState(settingsWith({}))).toEqual({
        kind: "checking",
        source: "managed",
      });
      expect(mockRunVersion).not.toHaveBeenCalled();
      await refreshGitHubCopilotInstallState(settingsWith({}));
      expect(getGitHubCopilotInstallState(settingsWith({}))).toEqual({
        kind: "ready",
        source: "managed",
      });
    });
  });

  describe("refreshGitHubCopilotInstallState()", () => {
    it("reports a configured path as the user's own", async () => {
      resolveBinary.mockReturnValue("/custom/copilot-b");
      mockRunVersion.mockResolvedValue({ stdout: "GitHub Copilot CLI 1.0.102-1.\n" });

      await expect(
        refreshGitHubCopilotInstallState(settingsWith({ binaryPath: "/custom/copilot-b" }))
      ).resolves.toEqual({ kind: "ready", source: "custom" });
    });

    it("reports absent without running anything when no CLI is installed", async () => {
      resolveBinary.mockReturnValue(null);

      await expect(refreshGitHubCopilotInstallState(settingsWith({}))).resolves.toEqual({
        kind: "absent",
      });
      expect(mockRunVersion).not.toHaveBeenCalled();
    });
  });

  describe("resolveGitHubCopilotCliPath()", () => {
    it("passes the configured path to the resolver as its first choice", () => {
      resolveBinary.mockReturnValue("/custom/copilot");

      expect(resolveGitHubCopilotCliPath(settingsWith({ binaryPath: "/custom/copilot" }))).toBe(
        "/custom/copilot"
      );
      expect(resolveBinary).toHaveBeenCalledWith(
        expect.objectContaining({ override: "/custom/copilot" })
      );
    });
  });

  describe("githubCopilotLaunch", () => {
    describe("assertCompatible()", () => {
      it("lets a supported CLI start", async () => {
        mockRunVersion.mockResolvedValue({ stdout: "GitHub Copilot CLI 1.0.102-1.\n" });

        await expect(
          githubCopilotLaunch.assertCompatible("/cli/copilot-c", { COPILOT_HOME: "/h" })
        ).resolves.toBeUndefined();
        expect(mockRunVersion).toHaveBeenCalledWith(
          "/cli/copilot-c",
          ["--version"],
          expect.objectContaining({ env: { COPILOT_HOME: "/h" } })
        );
      });

      it("refuses to start an older CLI with a message naming the minimum", async () => {
        mockRunVersion.mockResolvedValue({ stdout: "GitHub Copilot CLI 1.0.90.\n" });

        await expect(githubCopilotLaunch.assertCompatible("/cli/copilot-d", {})).rejects.toThrow(
          /1\.0\.90.*1\.0\.102/
        );
      });

      it("checks a previously failing CLI again, so a fixed install starts without a reload", async () => {
        mockRunVersion.mockRejectedValueOnce(new Error("busy"));
        await expect(githubCopilotLaunch.assertCompatible("/cli/copilot-e", {})).rejects.toThrow();

        mockRunVersion.mockResolvedValue({ stdout: "GitHub Copilot CLI 1.0.102-1.\n" });
        await expect(
          githubCopilotLaunch.assertCompatible("/cli/copilot-e", {})
        ).resolves.toBeUndefined();
      });
    });
  });

  describe("githubCopilotSignInCommand()", () => {
    const hostPlatform = process.platform;
    afterEach(() => Object.defineProperty(process, "platform", { value: hostPlatform }));

    it("runs login with the CLI the agent uses", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      resolveBinary.mockReturnValue("C:\\Program Files\\Copilot\\copilot.exe");

      expect(githubCopilotSignInCommand(settingsWith({}))).toBe(
        "& 'C:\\Program Files\\Copilot\\copilot.exe' login"
      );
    });

    it("carries an overridden GitHub host so sign-in reaches the same host as the agent", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      resolveBinary.mockReturnValue("/usr/local/bin/copilot");

      expect(
        githubCopilotSignInCommand(
          settingsWith({ envOverrides: { COPILOT_GH_HOST: "example.ghe.com" } })
        )
      ).toBe("COPILOT_GH_HOST=example.ghe.com /usr/local/bin/copilot login");
    });

    it("returns null when no CLI is installed", () => {
      resolveBinary.mockReturnValue(null);

      expect(githubCopilotSignInCommand(settingsWith({}))).toBeNull();
    });
  });
});
