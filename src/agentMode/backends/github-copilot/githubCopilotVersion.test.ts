import {
  GITHUB_COPILOT_MIN_VERSION,
  GitHubCopilotCompatibilityStore,
  parseGitHubCopilotVersion,
  probeGitHubCopilotInstall,
  type GitHubCopilotCompatibilityInput,
  type GitHubCopilotVersionRunner,
} from "./githubCopilotVersion";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";

function runnerPrinting(stdout: string): jest.MockedFunction<GitHubCopilotVersionRunner> {
  return jest.fn<ReturnType<GitHubCopilotVersionRunner>, Parameters<GitHubCopilotVersionRunner>>(
    async () => ({ stdout })
  );
}

function input(overrides: Partial<GitHubCopilotCompatibilityInput> = {}) {
  return {
    cacheKey: "/bin/copilot",
    path: "/bin/copilot",
    source: "managed" as const,
    getEnv: jest.fn(() => ({ COPILOT_HOME: "/home/.obsidian-copilot/github-copilot" })),
    ...overrides,
  };
}

describe("githubCopilotVersion", () => {
  describe("parseGitHubCopilotVersion()", () => {
    it(`reads the installed CLI's real output, dropping its numeric packaging revision ${ISSUE}`, () => {
      expect(
        parseGitHubCopilotVersion(
          "GitHub Copilot CLI 1.0.102-1.\nRun 'copilot update' to check for updates.\n"
        )
      ).toBe("1.0.102");
    });

    it("reads a version printed without a packaging revision", () => {
      expect(parseGitHubCopilotVersion("GitHub Copilot CLI 1.0.110\n")).toBe("1.0.110");
    });

    it("keeps a named prerelease so it is not mistaken for the stable release", () => {
      expect(parseGitHubCopilotVersion("GitHub Copilot CLI 1.0.103-beta.2\n")).toBe(
        "1.0.103-beta.2"
      );
    });

    it("returns null when the output names no version", () => {
      expect(parseGitHubCopilotVersion("command not found")).toBeNull();
    });
  });

  describe("probeGitHubCopilotInstall()", () => {
    it(`reports ready for the minimum version even though the installed build carries a packaging revision ${ISSUE}`, async () => {
      const run = runnerPrinting(`GitHub Copilot CLI ${GITHUB_COPILOT_MIN_VERSION}-1.\n`);

      await expect(probeGitHubCopilotInstall("/bin/copilot", {}, "managed", run)).resolves.toEqual({
        kind: "ready",
        source: "managed",
      });
    });

    it("runs --version with the given environment and a hidden window", async () => {
      const run = runnerPrinting("GitHub Copilot CLI 1.0.102-1.\n");
      const env = { COPILOT_HOME: "/h" };

      await probeGitHubCopilotInstall("/bin/copilot", env, "custom", run);

      expect(run).toHaveBeenCalledWith("/bin/copilot", ["--version"], {
        env,
        timeout: 10_000,
        windowsHide: true,
      });
    });

    it("reports an older CLI as incompatible and names the minimum", async () => {
      const run = runnerPrinting("GitHub Copilot CLI 1.0.90-2.\n");

      await expect(
        probeGitHubCopilotInstall("/bin/copilot", {}, "custom", run)
      ).resolves.toMatchObject({
        kind: "incompatible",
        source: "custom",
        currentVersion: "1.0.90",
        minVersion: GITHUB_COPILOT_MIN_VERSION,
      });
    });

    it("reports an error naming the minimum when the CLI cannot run", async () => {
      const run: GitHubCopilotVersionRunner = jest.fn(async () => {
        throw new Error("spawn ENOENT");
      });

      const state = await probeGitHubCopilotInstall("/bin/copilot", {}, "managed", run);

      expect(state.kind).toBe("error");
      expect("message" in state && state.message).toContain(GITHUB_COPILOT_MIN_VERSION);
    });

    it("reports an error when the output names no version", async () => {
      const state = await probeGitHubCopilotInstall(
        "/bin/copilot",
        {},
        "managed",
        runnerPrinting("unexpected banner")
      );

      expect(state).toMatchObject({ kind: "error" });
    });
  });

  describe("GitHubCopilotCompatibilityStore", () => {
    describe("get()", () => {
      it("reports checking, without building an environment, until a probe settles", () => {
        const store = new GitHubCopilotCompatibilityStore(runnerPrinting(""));
        const probe = input();

        expect(store.get(probe.cacheKey, "custom")).toEqual({ kind: "checking", source: "custom" });
        expect(probe.getEnv).not.toHaveBeenCalled();
      });
    });

    describe("refresh()", () => {
      it("caches the settled result so later reads need no process", async () => {
        const run = runnerPrinting("GitHub Copilot CLI 1.0.102-1.\n");
        const store = new GitHubCopilotCompatibilityStore(run);

        await store.refresh(input());
        await store.refresh(input());

        expect(run).toHaveBeenCalledTimes(1);
        expect(store.get("/bin/copilot", "managed")).toEqual({ kind: "ready", source: "managed" });
      });

      it("probes again when forced, so an upgraded CLI is noticed", async () => {
        const run = runnerPrinting("GitHub Copilot CLI 1.0.90.\n");
        const store = new GitHubCopilotCompatibilityStore(run);
        await store.refresh(input());
        run.mockResolvedValueOnce({ stdout: "GitHub Copilot CLI 1.0.102-1.\n" });

        await expect(store.refresh(input(), true)).resolves.toEqual({
          kind: "ready",
          source: "managed",
        });
        expect(run).toHaveBeenCalledTimes(2);
      });

      it("shares one probe between concurrent callers", async () => {
        const run = runnerPrinting("GitHub Copilot CLI 1.0.102-1.\n");
        const store = new GitHubCopilotCompatibilityStore(run);

        await Promise.all([store.refresh(input()), store.refresh(input(), true)]);

        expect(run).toHaveBeenCalledTimes(1);
      });

      it("settles as an error when the environment cannot be built", async () => {
        const store = new GitHubCopilotCompatibilityStore(runnerPrinting(""));

        await expect(
          store.refresh(
            input({
              getEnv: () => {
                throw new Error("no desktop runtime");
              },
            })
          )
        ).resolves.toEqual({ kind: "error", message: "no desktop runtime" });
      });
    });

    describe("subscribe()", () => {
      it("notifies when a probe starts and when it settles, and stops after unsubscribing", async () => {
        const store = new GitHubCopilotCompatibilityStore(
          runnerPrinting("GitHub Copilot CLI 1.0.102-1.\n")
        );
        const listener = jest.fn();
        const unsubscribe = store.subscribe(listener);

        await store.refresh(input());
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        await store.refresh(input(), true);
        expect(listener).toHaveBeenCalledTimes(2);
      });
    });
  });
});
