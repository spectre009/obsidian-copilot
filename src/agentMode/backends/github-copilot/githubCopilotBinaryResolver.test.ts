import {
  githubCopilotSearchDirs,
  isSpawnableGitHubCopilotPath,
  resolveGitHubCopilotBinary,
  type GitHubCopilotResolverInput,
} from "./githubCopilotBinaryResolver";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

const WINGET_PACKAGES = "C:\\Users\\me\\AppData\\Local\\Microsoft\\WinGet\\Packages";
const WINGET_EXE = `${WINGET_PACKAGES}\\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\\copilot.exe`;

function windowsInput(
  files: string[],
  overrides: Partial<GitHubCopilotResolverInput> = {}
): GitHubCopilotResolverInput {
  const existing = new Set(files);
  return {
    platform: "win32",
    homeDir: "C:\\Users\\me",
    env: {
      Path: "C:\\Tools;C:\\Users\\me\\AppData\\Roaming\\npm",
      LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local",
      ProgramFiles: "C:\\Program Files",
    },
    extraSearchDirs: [],
    fs: {
      existsSync: (p) => existing.has(p),
      readdirSync: (p) => {
        if (p !== WINGET_PACKAGES) throw new Error("ENOENT");
        return [
          "Other.Tool_Microsoft.Winget.Source_8wekyb3d8bbwe",
          "GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe",
        ];
      },
    },
    ...overrides,
  };
}

function posixInput(files: string[], override?: string): GitHubCopilotResolverInput {
  const existing = new Set(files);
  return {
    override,
    platform: "darwin",
    homeDir: "/Users/me",
    env: { PATH: "/usr/bin:/bin" },
    extraSearchDirs: ["/opt/homebrew/bin"],
    fs: { existsSync: (p) => existing.has(p), readdirSync: () => [] },
  };
}

describe("githubCopilotBinaryResolver", () => {
  describe("isSpawnableGitHubCopilotPath()", () => {
    it.each(["copilot.cmd", "copilot.ps1", "COPILOT.BAT"])(
      `rejects the Windows launcher %s, which cannot run without a shell ${ISSUE}`,
      (name) => {
        expect(isSpawnableGitHubCopilotPath(`C:\\npm\\${name}`, "win32")).toBe(false);
      }
    );

    it("accepts the native executable on Windows and any path elsewhere", () => {
      expect(isSpawnableGitHubCopilotPath(WINGET_EXE, "win32")).toBe(true);
      expect(isSpawnableGitHubCopilotPath("/usr/local/bin/copilot", "darwin")).toBe(true);
    });
  });

  describe("resolveGitHubCopilotBinary()", () => {
    it("prefers the configured path when it exists", () => {
      const custom = "D:\\cli\\copilot.exe";
      expect(
        resolveGitHubCopilotBinary(
          windowsInput([custom, "C:\\Tools\\copilot.exe"], { override: custom })
        )
      ).toBe(custom);
    });

    it("falls back to detection when the configured path no longer exists", () => {
      expect(
        resolveGitHubCopilotBinary(
          windowsInput(["C:\\Tools\\copilot.exe"], { override: "D:\\gone\\copilot.exe" })
        )
      ).toBe("C:\\Tools\\copilot.exe");
    });

    it(`ignores a configured npm launcher and finds the native CLI instead ${ISSUE}`, () => {
      const shim = "C:\\Users\\me\\AppData\\Roaming\\npm\\copilot.cmd";
      expect(resolveGitHubCopilotBinary(windowsInput([shim, WINGET_EXE], { override: shim }))).toBe(
        WINGET_EXE
      );
    });

    it("finds copilot.exe on PATH, read case-insensitively, before the WinGet folder", () => {
      expect(resolveGitHubCopilotBinary(windowsInput(["C:\\Tools\\copilot.exe", WINGET_EXE]))).toBe(
        "C:\\Tools\\copilot.exe"
      );
    });

    it(`finds the WinGet package when PATH has only an npm launcher ${ISSUE}`, () => {
      expect(
        resolveGitHubCopilotBinary(
          windowsInput(["C:\\Users\\me\\AppData\\Roaming\\npm\\copilot.cmd", WINGET_EXE])
        )
      ).toBe(WINGET_EXE);
    });

    it("finds the WinGet link before the package folder", () => {
      const link = "C:\\Users\\me\\AppData\\Local\\Microsoft\\WinGet\\Links\\copilot.exe";
      expect(resolveGitHubCopilotBinary(windowsInput([link, WINGET_EXE]))).toBe(link);
    });

    it("finds the CLI in a well-known folder a GUI launch leaves off PATH", () => {
      expect(resolveGitHubCopilotBinary(posixInput(["/opt/homebrew/bin/copilot"]))).toBe(
        "/opt/homebrew/bin/copilot"
      );
    });

    it("finds the install script's default ~/.local/bin on macOS and Linux", () => {
      expect(resolveGitHubCopilotBinary(posixInput(["/Users/me/.local/bin/copilot"]))).toBe(
        "/Users/me/.local/bin/copilot"
      );
    });

    it("returns null when no CLI is installed", () => {
      expect(resolveGitHubCopilotBinary(windowsInput([]))).toBeNull();
    });
  });

  describe("githubCopilotSearchDirs()", () => {
    it("lists every folder detection checks, once each", () => {
      const dirs = githubCopilotSearchDirs(windowsInput([]));

      expect(dirs).toEqual([
        "C:\\Tools",
        "C:\\Users\\me\\AppData\\Roaming\\npm",
        "C:\\Users\\me\\AppData\\Local\\Microsoft\\WinGet\\Links",
        `${WINGET_PACKAGES}\\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe`,
        "C:\\Program Files\\WinGet\\Links",
      ]);
    });
  });
});
