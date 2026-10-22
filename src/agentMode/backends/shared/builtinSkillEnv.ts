import { BREVILABS_API_BASE_URL } from "@/constants";
import { type CopilotSettings, getSettings } from "@/settings/model";
import { getMiyoCustomUrl } from "@/miyo/miyoUtils";
import {
  PLUS_ENV,
  SELF_HOST_WEB_SEARCH_ENV,
  SELF_HOST_WEB_SEARCH_TOKEN_ENV,
  SELF_HOST_WEB_SEARCH_URL_ENV,
} from "@/builtinSkills/builtinSkills";
import { OPENARTIFACTS_WORKSPACE_ROOT_ENV } from "@/openArtifacts/constants";
import {
  COPILOT_OBSIDIAN_CLI_ENV,
  resolveObsidianCliPath,
} from "@/agentMode/backends/shared/obsidianCliPath";
import { requireNodeModule } from "@/utils/desktopRuntime";
import type { BackendId } from "@/agentMode/session/types";
import {
  areVendorServicesBlocked,
  vendorServicesTransition,
} from "@/vendorServices/vendorServicesPolicy";

const MIYO_URL_ENV = "MIYO_URL";

const PROTECTED_BUILTIN_ENV_KEYS = [
  SELF_HOST_WEB_SEARCH_ENV,
  SELF_HOST_WEB_SEARCH_URL_ENV,
  SELF_HOST_WEB_SEARCH_TOKEN_ENV,
] as const;

const EMPTY_MANAGED_ENV: Readonly<Record<string, string>> = Object.freeze({});

export async function buildBuiltinSkillEnv(
  clientVersion = "",
  workspaceRootAbs = "",
  selfHostSearchChannel?: Readonly<{ url: string; token: string }>
): Promise<Readonly<Record<string, string>>> {
  const os = requireNodeModule<typeof import("node:os")>("os");
  const settings = getSettings();
  const env: Record<string, string> = {};

  if (workspaceRootAbs) env[OPENARTIFACTS_WORKSPACE_ROOT_ENV] = workspaceRootAbs;

  const obsidianCliPath = resolveObsidianCliPath({
    platform: process.platform,
    resourcesPath: (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath,
    homeDir: os.homedir(),
  });
  if (obsidianCliPath) env[COPILOT_OBSIDIAN_CLI_ENV] = obsidianCliPath;

  // The channel values are protected from backend overrides so Self-Host mode
  // cannot silently fall back to a hosted or agent-native search path.
  // https://github.com/Brevilabs/obsidian-copilot-private/issues/165
  if (settings.enableSelfHostMode === true && selfHostSearchChannel) {
    env[SELF_HOST_WEB_SEARCH_ENV] = "1";
    env[SELF_HOST_WEB_SEARCH_URL_ENV] = selfHostSearchChannel.url;
    env[SELF_HOST_WEB_SEARCH_TOKEN_ENV] = selfHostSearchChannel.token;
  }

  const miyoUrl = getMiyoCustomUrl(settings);
  if (miyoUrl) env[MIYO_URL_ENV] = miyoUrl;

  if (settings.isPaidUser && settings.plusLicenseKey && !areVendorServicesBlocked(settings)) {
    env[PLUS_ENV.licenseKey] = settings.plusLicenseKey;
    env[PLUS_ENV.baseUrl] = BREVILABS_API_BASE_URL;
    env[PLUS_ENV.userId] = settings.userId ?? "";
    env[PLUS_ENV.clientVersion] = clientVersion;
  }

  return Object.keys(env).length === 0 ? EMPTY_MANAGED_ENV : env;
}

export function sanitizeBuiltinSkillEnvOverrides(
  envOverrides?: Readonly<Record<string, string>>
): Record<string, string> {
  const sanitized = { ...(envOverrides ?? {}) };
  for (const key of PROTECTED_BUILTIN_ENV_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

export function getBuiltinSkillEnvRestartPolicy(
  prev: CopilotSettings,
  next: CopilotSettings,
  backendId: BackendId
): "none" | "deferred" | "immediate" {
  // A running agent keeps the vendor env and config it was spawned with, so blocking cannot wait
  // for a turn to end or for a Reload. https://github.com/spectre009/obsidian-copilot/issues/1
  const vendorTransition = vendorServicesTransition(prev, next);
  if (vendorTransition === "blocked") return "immediate";
  const ordinaryEnvChanged =
    vendorTransition === "allowed" ||
    prev.isPaidUser !== next.isPaidUser ||
    prev.plusLicenseKey !== next.plusLicenseKey ||
    prev.miyoConnectionMode !== next.miyoConnectionMode ||
    prev.miyoServerUrl !== next.miyoServerUrl;
  const selfHostRoutingChanged =
    backendId === "opencode" && prev.enableSelfHostMode !== next.enableSelfHostMode;
  if (!ordinaryEnvChanged && !selfHostRoutingChanged) return "none";
  if (
    selfHostRoutingChanged &&
    prev.enableSelfHostMode !== true &&
    next.enableSelfHostMode === true
  ) {
    return "immediate";
  }
  return "deferred";
}
