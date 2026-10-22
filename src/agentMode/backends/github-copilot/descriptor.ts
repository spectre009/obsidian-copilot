import { agentOriginEnabledModelEntries } from "@/agentMode/backends/shared/agentEnabledModels";
import { prefetchConfigEfforts } from "@/agentMode/backends/shared/prefetchConfigEfforts";
import { simpleBinaryBackendProcess } from "@/agentMode/backends/shared/simpleBinaryBackend";
import { terminalSignInCommand } from "@/agentMode/backends/shared/terminalSignInCommand";
import type {
  BackendDescriptor,
  BackendProcess,
  EnabledModelEntry,
  InstallState,
  ModelSelection,
  ModelSelectionSession,
  ModelWireCodec,
} from "@/agentMode/session/types";
import { resolveEffort } from "@/lib/model-effort";
import type CopilotPlugin from "@/main";
import {
  getSettings,
  subscribeToSettingsChange,
  updateAgentModeBackendFields,
  type CopilotSettings,
  type GitHubCopilotBackendSettings,
} from "@/settings/model";
import type { Destination } from "@/types/destination";
import { detectionSearchDirs } from "@/utils/binaryPath";
import { requireNodeModule } from "@/utils/desktopRuntime";
import {
  GITHUB_COPILOT_NOT_FOUND_MESSAGE,
  GitHubCopilotBackend,
  githubCopilotChildEnv,
  type GitHubCopilotLaunch,
} from "./GitHubCopilotBackend";
import { GitHubCopilotInstallModal } from "./GitHubCopilotInstallModal";
import { GitHubCopilotSettingsPanel } from "./GitHubCopilotSettingsPanel";
import {
  githubCopilotSearchDirs,
  resolveGitHubCopilotBinary,
  type GitHubCopilotResolverInput,
} from "./githubCopilotBinaryResolver";
import { githubCopilotHomesRoot } from "./githubCopilotHome";
import { buildGitHubCopilotModeMapping } from "./githubCopilotModeMapping";
import {
  GitHubCopilotCompatibilityStore,
  type GitHubCopilotCompatibilityInput,
} from "./githubCopilotVersion";
import GitHubCopilotLogo from "./logo.svg";

const BACKEND_ID = "github-copilot";

const ABSENT_INSTALL_STATE: InstallState = Object.freeze({ kind: "absent" });

const compatibilityStore = new GitHubCopilotCompatibilityStore();

export function updateGitHubCopilotFields(partial: Partial<GitHubCopilotBackendSettings>): void {
  updateAgentModeBackendFields(BACKEND_ID, partial);
}

function backendSettings(
  settings: Readonly<CopilotSettings>
): GitHubCopilotBackendSettings | undefined {
  return settings.agentMode?.backends?.[BACKEND_ID];
}

function resolverInput(override: string | undefined): GitHubCopilotResolverInput {
  const fs = requireNodeModule<typeof import("node:fs")>("fs");
  const os = requireNodeModule<typeof import("node:os")>("os");
  return {
    override,
    platform: process.platform,
    env: process.env,
    homeDir: os.homedir(),
    extraSearchDirs: detectionSearchDirs(),
    fs: {
      existsSync: (p) => fs.existsSync(p),
      readdirSync: (p) => fs.readdirSync(p),
    },
  };
}

export function resolveGitHubCopilotCliPath(settings: Readonly<CopilotSettings>): string | null {
  return resolveGitHubCopilotBinary(resolverInput(backendSettings(settings)?.binaryPath));
}

export function detectGitHubCopilotCliPath(): string | null {
  return resolveGitHubCopilotBinary(resolverInput(undefined));
}

export function githubCopilotDetectionSearchDirs(): string[] {
  return githubCopilotSearchDirs(resolverInput(undefined));
}

function compatibilityInput(
  settings: Readonly<CopilotSettings>,
  binaryPath: string,
  env?: NodeJS.ProcessEnv
): GitHubCopilotCompatibilityInput {
  return {
    // Overrides cannot set the variables that choose which CLI build runs, so the path alone
    // identifies the version. https://github.com/spectre009/obsidian-copilot/issues/2
    cacheKey: binaryPath,
    path: binaryPath,
    source: backendSettings(settings)?.binaryPath === binaryPath ? "custom" : "managed",
    getEnv: () => {
      if (env) return env;
      const os = requireNodeModule<typeof import("node:os")>("os");
      return githubCopilotChildEnv(settings, githubCopilotHomesRoot(os.homedir()), binaryPath);
    },
  };
}

export function getGitHubCopilotInstallState(settings: Readonly<CopilotSettings>): InstallState {
  const binaryPath = resolveGitHubCopilotCliPath(settings);
  if (!binaryPath) return ABSENT_INSTALL_STATE;
  const input = compatibilityInput(settings, binaryPath);
  return compatibilityStore.get(input.cacheKey, input.source);
}

export async function refreshGitHubCopilotInstallState(
  settings: Readonly<CopilotSettings>,
  force = false
): Promise<InstallState> {
  const binaryPath = resolveGitHubCopilotCliPath(settings);
  if (!binaryPath) return ABSENT_INSTALL_STATE;
  return compatibilityStore.refresh(compatibilityInput(settings, binaryPath), force);
}

export function subscribeGitHubCopilotInstallState(listener: () => void): () => void {
  return compatibilityStore.subscribe(listener);
}

// Sign-in guidance names the agent's own CLI and GitHub host, so the login lands where the agent reads it.
// https://github.com/spectre009/obsidian-copilot/issues/2
export function githubCopilotSignInCommand(settings: Readonly<CopilotSettings>): string | null {
  return terminalSignInCommand({
    binaryPath: resolveGitHubCopilotCliPath(settings) ?? undefined,
    args: ["login"],
    profileVariables: ["GH_HOST", "COPILOT_GH_HOST"],
    envOverrides: backendSettings(settings)?.envOverrides,
    platform: process.platform,
  });
}

const githubCopilotWire: ModelWireCodec = {
  // Effort is its own config option, so a model id never carries it.
  // https://github.com/spectre009/obsidian-copilot/issues/2
  encode: (selection: ModelSelection) => selection.baseModelId,
  decode: (wireId: string) => ({
    selection: { baseModelId: wireId, effort: null },
    provider: null,
  }),
};

export const githubCopilotLaunch: GitHubCopilotLaunch = {
  resolveBinary: resolveGitHubCopilotCliPath,
  async assertCompatible(binaryPath, env) {
    const input = compatibilityInput(getSettings(), binaryPath, env);
    // A cached failure is probed again, so a fixed install starts without a reload.
    // https://github.com/spectre009/obsidian-copilot/issues/2
    const state = await compatibilityStore.refresh(
      input,
      compatibilityStore.get(input.cacheKey, input.source).kind !== "ready"
    );
    if (state.kind !== "ready") {
      throw new Error("message" in state ? state.message : GITHUB_COPILOT_NOT_FOUND_MESSAGE);
    }
  },
};

export const GitHubCopilotBackendDescriptor: BackendDescriptor = {
  id: BACKEND_ID,
  displayName: "GitHub Copilot",
  Icon: GitHubCopilotLogo,
  selfHostable: false,
  routesCopilotModels: false,
  setupDescription:
    "Models from your GitHub Copilot plan, billed to it. Runs the GitHub Copilot CLI already on your machine.",
  skillsProjectDir: ".github/skills",
  crossDiscoveredAgents: [],
  restartOnManagedSkillsChange: true,
  restartOnProviderConfigChange: false,
  restartOnSystemPromptChange: true,
  summarizesSessionTitle: false,
  agentProductName: "GitHub Copilot CLI",
  wire: githubCopilotWire,
  showModelDescriptions: false,

  getEnabledModelEntries(settings: CopilotSettings): EnabledModelEntry[] {
    return [
      ...agentOriginEnabledModelEntries(settings, BACKEND_ID, (wireId) =>
        githubCopilotWire.decode(wireId)
      ),
    ];
  },

  // Provider and token variables are scrubbed, so inference always goes through the user's GitHub
  // sign-in. https://github.com/spectre009/obsidian-copilot/issues/2
  dataDestination(): Destination {
    return { kind: "cloud", label: "GitHub Copilot" };
  },

  getInstallState(settings: CopilotSettings): InstallState {
    return getGitHubCopilotInstallState(settings);
  },

  getResolvedBinaryPath(settings: CopilotSettings): string | null {
    return resolveGitHubCopilotCliPath(settings);
  },

  subscribeInstallState(_plugin: CopilotPlugin, cb: () => void): () => void {
    const unsubscribeSettings = subscribeToSettingsChange((prev, next) => {
      if (backendSettings(prev)?.binaryPath !== backendSettings(next)?.binaryPath) {
        cb();
        void refreshGitHubCopilotInstallState(next, true);
      }
    });
    const unsubscribeCompatibility = subscribeGitHubCopilotInstallState(cb);
    return () => {
      unsubscribeSettings();
      unsubscribeCompatibility();
    };
  },

  openInstallUI(plugin: CopilotPlugin): void {
    new GitHubCopilotInstallModal(plugin.app).open();
  },

  async onPluginLoad(): Promise<void> {
    await refreshGitHubCopilotInstallState(getSettings(), true);
  },

  async applySelection(session: ModelSelectionSession, selection: ModelSelection): Promise<void> {
    const currentBase = session.getState()?.model?.current.baseModelId;
    // Effort levels belong to the selected model's refreshed config catalog, so the model is set
    // first. https://github.com/spectre009/obsidian-copilot/issues/2
    if (currentBase !== selection.baseModelId) {
      await session.applyModelWireId(selection.baseModelId);
    }
    const model = session.getState()?.model;
    const effort = resolveEffort(
      selection.effort,
      model?.availableModels.find((entry) => entry.baseModelId === selection.baseModelId)
        ?.effortOptions
    );
    if (model?.apply.kind === "setConfigOption" && model.apply.effortConfigId && effort !== null) {
      await session.setConfigOption(model.apply.effortConfigId, effort);
    }
  },

  prefetchEffortCatalog: prefetchConfigEfforts,

  createBackendProcess(args): BackendProcess {
    return simpleBinaryBackendProcess(
      args,
      new GitHubCopilotBackend(args.clientVersion, githubCopilotLaunch)
    );
  },

  SettingsPanel: GitHubCopilotSettingsPanel,

  getModeMapping() {
    return buildGitHubCopilotModeMapping();
  },
};
