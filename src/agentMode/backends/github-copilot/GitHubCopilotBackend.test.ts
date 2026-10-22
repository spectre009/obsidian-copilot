import * as os from "node:os";
import { getSettings, resetSettings, setSettings } from "@/settings/model";
import {
  GITHUB_COPILOT_ACP_ARGS,
  GITHUB_COPILOT_NOT_FOUND_MESSAGE,
  GitHubCopilotBackend,
  githubCopilotChildEnv,
  githubCopilotSpawnArgs,
  type GitHubCopilotLaunch,
} from "./GitHubCopilotBackend";
import { githubCopilotHomeDir, writeGitHubCopilotInstructions } from "./githubCopilotHome";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));
jest.mock("@/agentMode/backends/shared/agentSystemPrompt", () => ({
  buildAgentSystemPrompt: (id: string) => `PROMPT:${id}`,
}));
jest.mock("@/agentMode/backends/shared/builtinSkillEnv", () => ({
  ...jest.requireActual("@/agentMode/backends/shared/builtinSkillEnv"),
  buildBuiltinSkillEnv: jest.fn(async () => ({ COPILOT_OBSIDIAN_CLI: "/obsidian/cli" })),
}));
jest.mock("./githubCopilotHome", () => ({
  ...jest.requireActual("./githubCopilotHome"),
  writeGitHubCopilotInstructions: jest.fn(async () => {}),
}));

const writeInstructions = jest.mocked(writeGitHubCopilotInstructions);

function launch(binary: string | null, compatible = true): jest.Mocked<GitHubCopilotLaunch> {
  return {
    resolveBinary: jest.fn<string | null, Parameters<GitHubCopilotLaunch["resolveBinary"]>>(
      () => binary
    ),
    assertCompatible: jest.fn<Promise<void>, Parameters<GitHubCopilotLaunch["assertCompatible"]>>(
      async () => {
        if (!compatible) throw new Error("GitHub Copilot CLI v1.0.90 is not supported.");
      }
    ),
  };
}

describe("GitHubCopilotBackend", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetSettings();
    setSettings({ blockVendorServices: true });
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe("GitHubCopilotBackend", () => {
    describe("buildSpawnDescriptor()", () => {
      it(`runs the installed CLI as an ACP server in the vault without auto-update or the question tool ${ISSUE}`, async () => {
        const backend = new GitHubCopilotBackend("4.0.15", launch("/bin/copilot"));

        const spawn = await backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" });

        expect(spawn.command).toBe("/bin/copilot");
        expect(spawn.args).toEqual(["--acp", "--stdio", "--no-auto-update", "--no-ask-user"]);
        expect(spawn.args).toEqual([...GITHUB_COPILOT_ACP_ARGS]);
        expect(spawn.cwd).toBe("/vaults/Work");
      });

      it(`gives each vault its own Copilot home and drops inherited Copilot controls ${ISSUE}`, async () => {
        process.env.COPILOT_ALLOW_ALL = "true";
        process.env.COPILOT_HOME = "/personal/.copilot";
        const backend = new GitHubCopilotBackend("4.0.15", launch("/bin/copilot"));

        const spawn = await backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" });

        expect(spawn.env.COPILOT_HOME).toBe(githubCopilotHomeDir(os.homedir(), "/vaults/Work"));
        expect(spawn.env.COPILOT_AUTO_UPDATE).toBe("false");
        expect(spawn.env.COPILOT_ALLOW_ALL).toBeUndefined();
        expect(spawn.env.COPILOT_OBSIDIAN_CLI).toBe("/obsidian/cli");
      });

      it(`checks the CLI with the exact spawn environment, then writes the vault's instructions ${ISSUE}`, async () => {
        const hooks = launch("/bin/copilot");
        const backend = new GitHubCopilotBackend("4.0.15", hooks);

        const spawn = await backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" });

        expect(hooks.assertCompatible).toHaveBeenCalledWith("/bin/copilot", spawn.env);
        expect(writeInstructions).toHaveBeenCalledWith(
          spawn.env.COPILOT_HOME,
          "PROMPT:github-copilot"
        );
        expect(hooks.assertCompatible.mock.invocationCallOrder[0]).toBeLessThan(
          writeInstructions.mock.invocationCallOrder[0]
        );
      });

      it("refuses to start an incompatible CLI and leaves its home untouched", async () => {
        const backend = new GitHubCopilotBackend("4.0.15", launch("/bin/copilot", false));

        await expect(
          backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" })
        ).rejects.toThrow("not supported");
        expect(writeInstructions).not.toHaveBeenCalled();
      });

      it("explains how to install the CLI when none is found", async () => {
        const hooks = launch(null);
        const backend = new GitHubCopilotBackend("4.0.15", hooks);

        await expect(
          backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" })
        ).rejects.toThrow(GITHUB_COPILOT_NOT_FOUND_MESSAGE);
        expect(hooks.assertCompatible).not.toHaveBeenCalled();
        expect(writeInstructions).not.toHaveBeenCalled();
      });

      it("launches with the long-context tier when the agent's context window is set to it, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        setSettings((cur) => ({
          agentMode: {
            ...cur.agentMode,
            backends: { "github-copilot": { contextWindow: "long_context" } },
          },
        }));
        const backend = new GitHubCopilotBackend("4.0.15", launch("/bin/copilot"));

        const spawn = await backend.buildSpawnDescriptor({ vaultBasePath: "/vaults/Work" });

        expect(spawn.args).toEqual([...GITHUB_COPILOT_ACP_ARGS, "--context", "long_context"]);
      });
    });
  });

  describe("githubCopilotSpawnArgs()", () => {
    it("adds no launch flag for the default context window", () => {
      expect(githubCopilotSpawnArgs(getSettings())).toEqual([]);
    });
  });

  describe("githubCopilotChildEnv()", () => {
    it("applies the user's overrides from settings around the given home", () => {
      setSettings((cur) => ({
        agentMode: {
          ...cur.agentMode,
          backends: {
            "github-copilot": { envOverrides: { HTTPS_PROXY: "http://proxy:8080", GH_TOKEN: "x" } },
          },
        },
      }));

      const env = githubCopilotChildEnv(getSettings(), "/home/h", "/bin/copilot");

      expect(env.HTTPS_PROXY).toBe("http://proxy:8080");
      expect(env.GH_TOKEN).toBeUndefined();
      expect(env.COPILOT_HOME).toBe("/home/h");
    });
  });
});
