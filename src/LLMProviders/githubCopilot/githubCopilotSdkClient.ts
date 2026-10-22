import type {
  CopilotClient,
  CopilotSession,
  ModelInfo as SdkModelInfo,
  SessionConfig,
} from "@github/copilot-sdk";
import { logInfo, logWarn } from "@/logger";
import { loadGitHubCopilotSdk, type GitHubCopilotSdk } from "./githubCopilotSdkLoader";

/** What the client needs to start the installed CLI for this vault. https://github.com/spectre009/obsidian-copilot/issues/3 */
export interface GitHubCopilotSdkLaunch {
  binaryPath: string;
  env: Record<string, string>;
  homeDir: string;
}

export interface GitHubCopilotAccount {
  authenticated: boolean;
  login?: string;
  host?: string;
  authType?: string;
  message?: string;
}

export interface GitHubCopilotSessionLease {
  session: CopilotSession;
  /** Ends the session and deletes it from disk; never throws. https://github.com/spectre009/obsidian-copilot/issues/3 */
  close(): Promise<void>;
}

/** The part of the client a chat model needs, so tests can supply a fake. https://github.com/spectre009/obsidian-copilot/issues/3 */
export interface GitHubCopilotChatBackend {
  getModel(modelId: string): Promise<SdkModelInfo | undefined>;
  openSession(config: SessionConfig): Promise<GitHubCopilotSessionLease>;
}

export interface GitHubCopilotSdkClientDeps {
  resolveLaunch: () => Promise<GitHubCopilotSdkLaunch>;
  clientVersion: string;
  loadSdk?: () => Promise<GitHubCopilotSdk>;
}

interface Generation {
  client: CopilotClient | null;
  ready: Promise<void>;
  inFlight: number;
  retired: boolean;
}

/**
 * Owns the GitHub Copilot CLI process behind Quick Chat: started on first use, shared by every
 * request, replaced when its launch settings change, and stopped on unload. Each request gets its
 * own short-lived session; this class never replays a request.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
export class GitHubCopilotSdkClient implements GitHubCopilotChatBackend {
  readonly #deps: GitHubCopilotSdkClientDeps;
  #current: Generation | null = null;
  readonly #retired = new Set<Generation>();
  #stopped = false;
  #cleanedOrphans = false;

  constructor(deps: GitHubCopilotSdkClientDeps) {
    this.#deps = deps;
  }

  async listModels(): Promise<SdkModelInfo[]> {
    return this.#withClient((client) => client.listModels());
  }

  async getModel(modelId: string): Promise<SdkModelInfo | undefined> {
    return (await this.listModels()).find((model) => model.id === modelId);
  }

  async getAccount(): Promise<GitHubCopilotAccount> {
    const status = await this.#withClient((client) => client.getAuthStatus());
    return {
      authenticated: status.isAuthenticated,
      login: status.login,
      host: status.host,
      authType: status.authType,
      message: status.statusMessage,
    };
  }

  async openSession(config: SessionConfig): Promise<GitHubCopilotSessionLease> {
    const generation = await this.#acquire();
    let session: CopilotSession;
    try {
      session = await this.#clientOf(generation).createSession(config);
    } catch (error) {
      this.#release(generation);
      throw error;
    }
    let closed = false;
    return {
      session,
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await session.disconnect().catch(() => undefined);
          await this.#clientOf(generation).deleteSession(session.sessionId);
        } catch (error) {
          logWarn("[GitHubCopilot] Could not delete a Quick Chat session", error);
        } finally {
          this.#release(generation);
        }
      },
    };
  }

  /**
   * Makes the next request start a fresh CLI, for example after its path or environment changed.
   * Requests already running finish on the old process, which stops once they do.
   * https://github.com/spectre009/obsidian-copilot/issues/3
   * @param reason logged to explain the restart
   */
  invalidate(reason: string): void {
    const current = this.#current;
    if (!current) return;
    logInfo(`[GitHubCopilot] Restarting the Quick Chat CLI: ${reason}`);
    this.#current = null;
    this.#retire(current);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    const generations = [...this.#retired, ...(this.#current ? [this.#current] : [])];
    this.#current = null;
    this.#retired.clear();
    await Promise.all(generations.map((generation) => this.#stopGeneration(generation)));
  }

  async #withClient<T>(run: (client: CopilotClient) => Promise<T>): Promise<T> {
    const generation = await this.#acquire();
    try {
      return await run(this.#clientOf(generation));
    } finally {
      this.#release(generation);
    }
  }

  #clientOf(generation: Generation): CopilotClient {
    if (!generation.client) throw new Error("GitHub Copilot client is not started.");
    return generation.client;
  }

  async #acquire(): Promise<Generation> {
    if (this.#stopped) throw new Error("GitHub Copilot Quick Chat has stopped.");
    const generation = (this.#current ??= this.#start());
    generation.inFlight += 1;
    try {
      await generation.ready;
      return generation;
    } catch (error) {
      generation.inFlight -= 1;
      // A failed start is not cached, so fixing the install or sign-in works without a reload.
      // https://github.com/spectre009/obsidian-copilot/issues/3
      if (this.#current === generation) this.#current = null;
      void this.#stopGeneration(generation);
      throw error;
    }
  }

  #release(generation: Generation): void {
    generation.inFlight -= 1;
    if (generation.retired && generation.inFlight <= 0) {
      this.#retired.delete(generation);
      void this.#stopGeneration(generation);
    }
  }

  #retire(generation: Generation): void {
    generation.retired = true;
    if (generation.inFlight <= 0) void this.#stopGeneration(generation);
    else this.#retired.add(generation);
  }

  #start(): Generation {
    const generation: Generation = {
      client: null,
      ready: Promise.resolve(),
      inFlight: 0,
      retired: false,
    };
    generation.ready = (async () => {
      const [sdk, launch] = await Promise.all([
        (this.#deps.loadSdk ?? loadGitHubCopilotSdk)(),
        this.#deps.resolveLaunch(),
      ]);
      const client = new sdk.CopilotClient({
        connection: sdk.RuntimeConnection.forStdio({
          path: launch.binaryPath,
          env: launch.env,
        }),
        baseDirectory: launch.homeDir,
        workingDirectory: launch.homeDir,
        mode: "empty",
        logLevel: "error",
        clientInfo: {
          applicationName: "obsidian-copilot",
          applicationVersion: this.#deps.clientVersion,
          integrationName: "quick-chat",
        },
      });
      generation.client = client;
      await client.start();
      await this.#cleanOrphans(client);
    })();
    return generation;
  }

  // The quick-chat home holds only this plugin's per-request sessions, so any left on disk at
  // startup were orphaned by a crash. Later restarts skip this: an older process may still be
  // finishing sessions in the same home. https://github.com/spectre009/obsidian-copilot/issues/3
  async #cleanOrphans(client: CopilotClient): Promise<void> {
    if (this.#cleanedOrphans || this.#retired.size > 0) return;
    this.#cleanedOrphans = true;
    try {
      const sessions = await client.listSessions();
      for (const session of sessions) {
        await client.deleteSession(session.sessionId).catch((error: unknown) => {
          logWarn("[GitHubCopilot] Could not delete an orphaned Quick Chat session", error);
        });
      }
    } catch (error) {
      logWarn("[GitHubCopilot] Could not list orphaned Quick Chat sessions", error);
    }
  }

  async #stopGeneration(generation: Generation): Promise<void> {
    await generation.ready.catch(() => undefined);
    const client = generation.client;
    generation.client = null;
    if (!client) return;
    try {
      const errors = await client.stop();
      if (errors.length > 0) logWarn("[GitHubCopilot] Quick Chat CLI stopped with errors", errors);
    } catch (error) {
      logWarn("[GitHubCopilot] Quick Chat CLI did not stop cleanly; forcing it", error);
      await client.forceStop().catch(() => undefined);
    }
  }
}
