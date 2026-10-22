import { classifyBinaryInstall } from "@/agentMode/backends/shared/binaryCompatibility";
import type { InstallState } from "@/agentMode/session/types";
import { requireNodeModule } from "@/utils/desktopRuntime";

const VERSION_TIMEOUT_MS = 10_000;

export const GITHUB_COPILOT_CLI_NAME = "GitHub Copilot CLI";

// The ACP model, effort and mode contract this backend reads was verified against 1.0.102.
// https://github.com/spectre009/obsidian-copilot/issues/2
export const GITHUB_COPILOT_MIN_VERSION = "1.0.102";

export type GitHubCopilotVersionRunner = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean }
) => Promise<{ stdout: string }>;

async function runVersion(
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean }
): Promise<{ stdout: string }> {
  const { execFile } = requireNodeModule<typeof import("node:child_process")>("child_process");
  const { promisify } = requireNodeModule<typeof import("node:util")>("util");
  return promisify(execFile)(command, args, options);
}

export function parseGitHubCopilotVersion(stdout: string): string | null {
  const match = stdout.match(/\b(\d+\.\d+\.\d+)(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?/);
  if (!match) return null;
  const [, core, suffix] = match;
  // Installed builds carry a numeric packaging revision (`1.0.102-1`). Read as semver it would be a
  // prerelease, which the shared check rejects at the minimum version itself.
  // https://github.com/spectre009/obsidian-copilot/issues/2
  if (!suffix || /^-\d+$/.test(suffix)) return core;
  return `${core}${suffix}`;
}

export async function probeGitHubCopilotInstall(
  command: string,
  env: NodeJS.ProcessEnv,
  source: "managed" | "custom",
  run: GitHubCopilotVersionRunner = runVersion
): Promise<InstallState> {
  let stdout: string;
  try {
    ({ stdout } = await run(command, ["--version"], {
      env,
      timeout: VERSION_TIMEOUT_MS,
      windowsHide: true,
    }));
  } catch {
    return {
      kind: "error",
      message: `Could not run ${command} --version. Copilot requires ${GITHUB_COPILOT_CLI_NAME} ${GITHUB_COPILOT_MIN_VERSION} or newer.`,
    };
  }
  const version = parseGitHubCopilotVersion(stdout);
  if (!version) {
    return {
      kind: "error",
      message: `Could not read the ${GITHUB_COPILOT_CLI_NAME} version. Copilot requires ${GITHUB_COPILOT_CLI_NAME} ${GITHUB_COPILOT_MIN_VERSION} or newer.`,
    };
  }
  return classifyBinaryInstall(
    { kind: "installed", version, source },
    GITHUB_COPILOT_MIN_VERSION,
    GITHUB_COPILOT_CLI_NAME
  );
}

export interface GitHubCopilotCompatibilityInput {
  cacheKey: string;
  path: string;
  source: "managed" | "custom";
  getEnv: () => NodeJS.ProcessEnv;
}

const CHECKING_STATES = Object.freeze({
  managed: Object.freeze({ kind: "checking", source: "managed" }),
  custom: Object.freeze({ kind: "checking", source: "custom" }),
}) satisfies Readonly<Record<GitHubCopilotCompatibilityInput["source"], InstallState>>;

/**
 * Caches the version check of each resolved CLI so the synchronous install-state reads behind the
 * settings and chat UI never spawn a process. It owns only the probe results; resolving which
 * executable to check stays with the caller. https://github.com/spectre009/obsidian-copilot/issues/2
 */
export class GitHubCopilotCompatibilityStore {
  private readonly states = new Map<string, InstallState>();
  private readonly inflight = new Map<string, Promise<InstallState>>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly run: GitHubCopilotVersionRunner = runVersion) {}

  get(cacheKey: string, source: GitHubCopilotCompatibilityInput["source"]): InstallState {
    return this.states.get(cacheKey) ?? CHECKING_STATES[source];
  }

  refresh(input: GitHubCopilotCompatibilityInput, force = false): Promise<InstallState> {
    const running = this.inflight.get(input.cacheKey);
    if (running) return running;
    const cached = this.states.get(input.cacheKey);
    if (!force && cached && cached.kind !== "checking") return Promise.resolve(cached);

    this.set(input.cacheKey, CHECKING_STATES[input.source]);
    const promise = Promise.resolve()
      .then(() => probeGitHubCopilotInstall(input.path, input.getEnv(), input.source, this.run))
      .catch(
        (error: unknown): InstallState => ({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        })
      )
      .then((state) => {
        this.set(input.cacheKey, state);
        return state;
      })
      .finally(() => this.inflight.delete(input.cacheKey));
    this.inflight.set(input.cacheKey, promise);
    return promise;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(key: string, state: InstallState): void {
    this.states.set(key, state);
    for (const listener of this.listeners) listener();
  }
}
