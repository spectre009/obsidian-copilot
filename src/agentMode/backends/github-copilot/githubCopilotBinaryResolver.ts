import { requireNodeModule } from "@/utils/desktopRuntime";

export interface GitHubCopilotResolverFs {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
}

export interface GitHubCopilotResolverInput {
  override?: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  extraSearchDirs: readonly string[];
  fs: GitHubCopilotResolverFs;
}

// npm installs `copilot.cmd` / `copilot.ps1` shims, which Node cannot spawn without a shell, so only
// the native executable is accepted on Windows. https://github.com/spectre009/obsidian-copilot/issues/2
const WINDOWS_SHIM_PATTERN = /\.(cmd|bat|ps1)$/i;

const WINGET_PACKAGE_PREFIX = "GitHub.Copilot_";

function binaryName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "copilot.exe" : "copilot";
}

function pathImpl(platform: NodeJS.Platform): typeof import("node:path").posix {
  const path = requireNodeModule<typeof import("node:path")>("path");
  return platform === "win32" ? path.win32 : path.posix;
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

function pathDirs(input: GitHubCopilotResolverInput): string[] {
  const separator = input.platform === "win32" ? ";" : ":";
  return (envValue(input.env, "PATH") ?? "").split(separator).filter(Boolean);
}

function wingetPackageCandidates(input: GitHubCopilotResolverInput): string[] {
  const win = pathImpl("win32");
  const localAppData =
    envValue(input.env, "LOCALAPPDATA") ?? win.join(input.homeDir, "AppData", "Local");
  const programFiles = envValue(input.env, "PROGRAMFILES") ?? "C:\\Program Files";
  const candidates: string[] = [];
  for (const wingetRoot of [
    win.join(localAppData, "Microsoft", "WinGet"),
    win.join(programFiles, "WinGet"),
  ]) {
    candidates.push(win.join(wingetRoot, "Links", "copilot.exe"));
    const packagesRoot = win.join(wingetRoot, "Packages");
    let entries: string[] = [];
    try {
      entries = input.fs.readdirSync(packagesRoot);
    } catch {
      continue;
    }
    for (const entry of entries.filter((name) => name.startsWith(WINGET_PACKAGE_PREFIX)).sort()) {
      candidates.push(win.join(packagesRoot, entry, "copilot.exe"));
    }
  }
  return candidates;
}

function candidatePaths(input: GitHubCopilotResolverInput): string[] {
  const path = pathImpl(input.platform);
  const name = binaryName(input.platform);
  const dirs = [...pathDirs(input), ...input.extraSearchDirs];
  if (input.platform !== "win32") dirs.push(path.join(input.homeDir, ".local", "bin"));
  const candidates = dirs.map((dir) => path.join(dir, name));
  if (input.platform === "win32") candidates.push(...wingetPackageCandidates(input));
  return Array.from(new Set(candidates));
}

export function isSpawnableGitHubCopilotPath(
  candidate: string,
  platform: NodeJS.Platform
): boolean {
  return platform !== "win32" || !WINDOWS_SHIM_PATTERN.test(candidate);
}

/**
 * Finds the installed GitHub Copilot CLI: the user's explicit path when it exists, then PATH and
 * the well-known folders a GUI launch leaves off it, then the WinGet install folders.
 * https://github.com/spectre009/obsidian-copilot/issues/2
 */
export function resolveGitHubCopilotBinary(input: GitHubCopilotResolverInput): string | null {
  const { override, fs } = input;
  if (
    override &&
    isSpawnableGitHubCopilotPath(override, input.platform) &&
    fs.existsSync(override)
  ) {
    return override;
  }
  return candidatePaths(input).find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function githubCopilotSearchDirs(input: GitHubCopilotResolverInput): string[] {
  const path = pathImpl(input.platform);
  return Array.from(new Set(candidatePaths(input).map((candidate) => path.dirname(candidate))));
}
