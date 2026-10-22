import type { GitHubCopilotSdk } from "./githubCopilotSdkLoader";
import { GitHubCopilotSdkClient, type GitHubCopilotSdkLaunch } from "./githubCopilotSdkClient";

jest.mock("@/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));

const LAUNCH: GitHubCopilotSdkLaunch = {
  binaryPath: "C:\\bin\\copilot.exe",
  env: { COPILOT_HOME: "C:\\home\\quick-chat" },
  homeDir: "C:\\home\\quick-chat",
};

interface FakeClient {
  options: Record<string, unknown>;
  start: jest.Mock;
  stop: jest.Mock;
  forceStop: jest.Mock;
  listModels: jest.Mock;
  getAuthStatus: jest.Mock;
  listSessions: jest.Mock;
  deleteSession: jest.Mock;
  createSession: jest.Mock;
}

function fakeSdk(configure: (client: FakeClient) => void = () => undefined) {
  const clients: FakeClient[] = [];
  const CopilotClient = jest.fn().mockImplementation((options: Record<string, unknown>) => {
    const client: FakeClient = {
      options,
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => []),
      forceStop: jest.fn(async () => undefined),
      listModels: jest.fn(async () => [{ id: "claude-haiku-4.5" }]),
      getAuthStatus: jest.fn(async () => ({
        isAuthenticated: true,
        login: "octocat",
        host: "https://github.com",
        authType: "gh-cli",
      })),
      listSessions: jest.fn(async () => []),
      deleteSession: jest.fn(async () => undefined),
      createSession: jest.fn(async () => ({
        sessionId: `s${clients.length}`,
        disconnect: jest.fn(async () => undefined),
      })),
    };
    configure(client);
    clients.push(client);
    return client;
  });
  const RuntimeConnection = { forStdio: jest.fn((opts: unknown) => ({ kind: "stdio", opts })) };
  const sdk = { CopilotClient, RuntimeConnection } as unknown as GitHubCopilotSdk;
  return { sdk, clients, RuntimeConnection };
}

function createClient(sdk: GitHubCopilotSdk, resolveLaunch = jest.fn(async () => LAUNCH)) {
  return new GitHubCopilotSdkClient({
    clientVersion: "4.0.15",
    resolveLaunch,
    loadSdk: async () => sdk,
  });
}

describe("githubCopilotSdkClient", () => {
  describe("GitHubCopilotSdkClient", () => {
    describe("listModels()", () => {
      it("starts one CLI on first use with the vault's launch, an isolated empty-mode home and the plugin's identity, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const { sdk, clients, RuntimeConnection } = fakeSdk();
        const client = createClient(sdk);

        await client.listModels();
        await client.listModels();

        expect(clients).toHaveLength(1);
        expect(RuntimeConnection.forStdio).toHaveBeenCalledWith({
          path: LAUNCH.binaryPath,
          env: LAUNCH.env,
        });
        expect(clients[0].options).toMatchObject({
          baseDirectory: LAUNCH.homeDir,
          workingDirectory: LAUNCH.homeDir,
          mode: "empty",
          clientInfo: {
            applicationName: "obsidian-copilot",
            applicationVersion: "4.0.15",
            integrationName: "quick-chat",
          },
        });
        expect(clients[0].start).toHaveBeenCalledTimes(1);
      });

      it("deletes sessions orphaned by an earlier crash before the first request, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const { sdk, clients } = fakeSdk((client) => {
          client.listSessions.mockResolvedValue([{ sessionId: "old-1" }, { sessionId: "old-2" }]);
        });

        await createClient(sdk).listModels();

        expect(clients[0].deleteSession.mock.calls).toEqual([["old-1"], ["old-2"]]);
      });

      it("doesn't cache a failed start, so the next request tries again, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const resolveLaunch = jest
          .fn<Promise<GitHubCopilotSdkLaunch>, []>()
          .mockRejectedValueOnce(new Error("GitHub Copilot CLI not found."))
          .mockResolvedValue(LAUNCH);
        const { sdk, clients } = fakeSdk();
        const client = createClient(sdk, resolveLaunch);

        await expect(client.listModels()).rejects.toThrow("GitHub Copilot CLI not found.");
        await expect(client.listModels()).resolves.toEqual([{ id: "claude-haiku-4.5" }]);

        expect(clients).toHaveLength(1);
        expect(resolveLaunch).toHaveBeenCalledTimes(2);
      });
    });

    describe("getModel()", () => {
      it("finds a model by id in the CLI's list", async () => {
        const { sdk } = fakeSdk();
        const client = createClient(sdk);

        await expect(client.getModel("claude-haiku-4.5")).resolves.toEqual({
          id: "claude-haiku-4.5",
        });
        await expect(client.getModel("missing")).resolves.toBeUndefined();
      });
    });

    describe("getAccount()", () => {
      it("reports the signed-in account the CLI uses", async () => {
        const { sdk } = fakeSdk();

        await expect(createClient(sdk).getAccount()).resolves.toEqual({
          authenticated: true,
          login: "octocat",
          host: "https://github.com",
          authType: "gh-cli",
          message: undefined,
        });
      });
    });

    describe("openSession()", () => {
      it("creates a session with the given config and deletes it from disk on close", async () => {
        const { sdk, clients } = fakeSdk();
        const client = createClient(sdk);

        const lease = await client.openSession({ model: "claude-haiku-4.5" });
        await lease.close();
        await lease.close();

        expect(clients[0].createSession).toHaveBeenCalledWith({ model: "claude-haiku-4.5" });
        expect(clients[0].deleteSession).toHaveBeenCalledTimes(1);
        expect(clients[0].deleteSession).toHaveBeenCalledWith(lease.session.sessionId);
      });

      it("closes without throwing when deleting the session fails, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const { sdk } = fakeSdk((client) => {
          client.deleteSession.mockRejectedValue(new Error("gone"));
        });
        const lease = await createClient(sdk).openSession({});

        await expect(lease.close()).resolves.toBeUndefined();
      });
    });

    describe("invalidate()", () => {
      it("lets a running request finish on the old CLI, stops it afterwards, and starts a new one for the next request, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const { sdk, clients } = fakeSdk();
        const client = createClient(sdk);
        const lease = await client.openSession({});

        client.invalidate("launch settings changed");
        expect(clients[0].stop).not.toHaveBeenCalled();
        await client.listModels();
        expect(clients).toHaveLength(2);

        await lease.close();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        expect(clients[0].stop).toHaveBeenCalledTimes(1);
        expect(clients[1].stop).not.toHaveBeenCalled();
      });

      it("skips orphan cleanup on a restart while an older CLI may still own sessions in the same home", async () => {
        const { sdk, clients } = fakeSdk();
        const client = createClient(sdk);
        const lease = await client.openSession({});
        client.invalidate("launch settings changed");

        await client.listModels();

        expect(clients[1].listSessions).not.toHaveBeenCalled();
        await lease.close();
      });
    });

    describe("stop()", () => {
      it("stops every CLI and refuses later requests", async () => {
        const { sdk, clients } = fakeSdk();
        const client = createClient(sdk);
        await client.listModels();

        await client.stop();

        expect(clients[0].stop).toHaveBeenCalledTimes(1);
        await expect(client.listModels()).rejects.toThrow("has stopped");
      });

      it("forces a CLI that doesn't stop cleanly", async () => {
        const { sdk, clients } = fakeSdk((client) => {
          client.stop.mockRejectedValue(new Error("hung"));
        });
        const client = createClient(sdk);
        await client.listModels();

        await client.stop();

        expect(clients[0].forceStop).toHaveBeenCalledTimes(1);
      });
    });
  });
});
