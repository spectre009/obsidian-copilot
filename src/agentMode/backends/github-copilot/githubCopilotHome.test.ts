import * as path from "node:path";
import { md5 } from "@/utils/hash";
import {
  GITHUB_COPILOT_INSTRUCTIONS_FILE,
  githubCopilotHomeDir,
  githubCopilotHomesRoot,
  writeGitHubCopilotInstructions,
  type GitHubCopilotHomeFs,
} from "./githubCopilotHome";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

function recordingFs(overrides: Partial<GitHubCopilotHomeFs> = {}) {
  const calls: string[] = [];
  const fs: GitHubCopilotHomeFs = {
    mkdir: jest.fn(async (p: string) => {
      calls.push(`mkdir ${p}`);
    }),
    writeFile: jest.fn(async (p: string, content: string) => {
      calls.push(`write ${p} ${content}`);
    }),
    rename: jest.fn(async (from: string, to: string) => {
      calls.push(`rename ${from} -> ${to}`);
    }),
    rm: jest.fn(async (p: string) => {
      calls.push(`rm ${p}`);
    }),
    ...overrides,
  };
  return { fs, calls };
}

describe("githubCopilotHome", () => {
  describe("githubCopilotHomesRoot()", () => {
    it("is ~/.obsidian-copilot/github-copilot, outside every vault", () => {
      expect(githubCopilotHomesRoot("/Users/me")).toBe(
        path.join("/Users/me", ".obsidian-copilot", "github-copilot")
      );
    });
  });

  describe("githubCopilotHomeDir()", () => {
    it("names the vault's own folder by the same id the plugin uses for its other per-vault files", () => {
      expect(githubCopilotHomeDir("/Users/me", "/vaults/Work")).toBe(
        path.join(
          "/Users/me",
          ".obsidian-copilot",
          "github-copilot",
          md5("/vaults/Work").slice(0, 8)
        )
      );
    });

    it(`gives two vaults different homes so neither overwrites the other's instructions ${ISSUE}`, () => {
      expect(githubCopilotHomeDir("/Users/me", "/vaults/Work")).not.toBe(
        githubCopilotHomeDir("/Users/me", "/vaults/Personal")
      );
    });
  });

  describe("writeGitHubCopilotInstructions()", () => {
    it(`creates the home, then replaces copilot-instructions.md through a temporary file ${ISSUE}`, async () => {
      const { fs, calls } = recordingFs();
      const target = path.join("/h", GITHUB_COPILOT_INSTRUCTIONS_FILE);

      await writeGitHubCopilotInstructions("/h", "Be helpful.", fs);

      expect(calls[0]).toBe("mkdir /h");
      expect(calls[1]).toMatch(new RegExp(`^write ${escape(target)}\\..+\\.tmp Be helpful\\.$`));
      expect(calls[2]).toMatch(
        new RegExp(`^rename ${escape(target)}\\..+\\.tmp -> ${escape(target)}$`)
      );
      expect(calls).toHaveLength(3);
    });

    it("uses a fresh temporary name for each write", async () => {
      const { fs } = recordingFs();

      await writeGitHubCopilotInstructions("/h", "a", fs);
      await writeGitHubCopilotInstructions("/h", "b", fs);

      const temps = jest.mocked(fs.writeFile).mock.calls.map(([p]) => p);
      expect(new Set(temps).size).toBe(2);
    });

    it("removes the temporary file and reports the failure when the replace fails", async () => {
      const { fs, calls } = recordingFs({
        rename: jest.fn(async () => {
          throw new Error("EBUSY");
        }),
      });

      await expect(writeGitHubCopilotInstructions("/h", "x", fs)).rejects.toThrow("EBUSY");
      expect(calls[calls.length - 1]).toMatch(/^rm .+\.tmp$/);
    });
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
