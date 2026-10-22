import type { SessionEvent } from "@github/copilot-sdk";
import { AIMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isDesktopRuntime } from "@/utils/desktopRuntime";
import { ChatGitHubCopilot } from "./ChatGitHubCopilot";
import type { GitHubCopilotChatBackend } from "./githubCopilotSdkClient";

jest.mock("@/utils/desktopRuntime", () => ({ isDesktopRuntime: jest.fn(() => true) }));
jest.mock("@/logger", () => ({ logWarn: jest.fn(), logInfo: jest.fn() }));

const SONNET = {
  id: "claude-sonnet-5.5",
  name: "Claude Sonnet 5.5",
  capabilities: {
    supports: { vision: false, reasoningEffort: true },
    limits: { max_context_window_tokens: 200000 },
  },
  supportedReasoningEfforts: ["low", "medium", "high"],
  billing: { tokenPrices: { longContext: { maxPromptTokens: 968000 } } },
};

class FakeSession {
  readonly sessionId: string;
  handler: ((event: SessionEvent) => void) | null = null;
  readonly sends: unknown[] = [];
  readonly abort = jest.fn(async () => {
    this.reject(new Error("The requested run was aborted before completion."));
  });
  private resolveRun: (() => void) | null = null;
  private rejectRun: ((error: unknown) => void) | null = null;
  readonly sendAndWait = jest.fn((options: unknown, timeout: number) => {
    this.sends.push({ options, timeout });
    return new Promise<void>((resolve, reject) => {
      this.resolveRun = resolve;
      this.rejectRun = reject;
    });
  });

  constructor(id: string) {
    this.sessionId = id;
  }

  on(handler: (event: SessionEvent) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  emit(type: string, data: Record<string, unknown>, agentId?: string): void {
    this.handler?.({ type, data, agentId } as unknown as SessionEvent);
  }

  finish(): void {
    this.resolveRun?.();
  }

  reject(error: unknown): void {
    this.rejectRun?.(error);
  }
}

function fakeBackend() {
  const sessions: FakeSession[] = [];
  const closes = jest.fn(async () => undefined);
  const configs: unknown[] = [];
  let gate: Promise<void> = Promise.resolve();
  const backend: GitHubCopilotChatBackend = {
    getModel: jest.fn(async (id: string) => (id === SONNET.id ? (SONNET as never) : undefined)),
    openSession: jest.fn(async (config: unknown) => {
      configs.push(config);
      await gate;
      const session = new FakeSession(`s${sessions.length + 1}`);
      sessions.push(session);
      return { session: session as never, close: closes };
    }),
  };
  return {
    backend,
    sessions,
    closes,
    configs,
    holdOpen(promise: Promise<void>) {
      gate = promise;
    },
  };
}

function createModel(
  backend: GitHubCopilotChatBackend | null,
  overrides: Partial<ConstructorParameters<typeof ChatGitHubCopilot>[0]> = {}
) {
  return new ChatGitHubCopilot({
    modelName: SONNET.id,
    displayName: SONNET.name,
    getBackend: () => backend,
    ...overrides,
  });
}

async function nextTick(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function text(chunk: AIMessageChunk): string {
  return typeof chunk.content === "string" ? chunk.content : "";
}

describe("ChatGitHubCopilot", () => {
  beforeAll(() => {
    // Electron's AbortSignal has throwIfAborted, which LangChain calls between streamed chunks;
    // jsdom's doesn't. https://github.com/spectre009/obsidian-copilot/issues/3
    const proto = AbortSignal.prototype as AbortSignal & { throwIfAborted?: () => void };
    if (!proto.throwIfAborted) {
      proto.throwIfAborted = function (this: AbortSignal) {
        if (this.aborted) throw this.reason;
      };
    }
  });

  describe("ChatGitHubCopilot", () => {
    describe("_streamResponseChunks()", () => {
      it("streams answer deltas as content, reasoning deltas as reasoning_content, then one usage chunk, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const fake = fakeBackend();
        const model = createModel(fake.backend);
        const chunks: AIMessageChunk[] = [];

        const run = (async () => {
          for await (const chunk of await model.stream([new HumanMessage("Hi")])) {
            chunks.push(chunk);
          }
        })();
        await nextTick();
        const session = fake.sessions[0];
        session.emit("assistant.reasoning_delta", { deltaContent: "Thinking" });
        session.emit("assistant.message_delta", { deltaContent: "Hel" });
        session.emit("assistant.message_delta", { deltaContent: "lo" });
        session.emit("assistant.message_delta", { deltaContent: "ignored" }, "sub-agent");
        session.emit("assistant.usage", {
          inputTokens: 113,
          outputTokens: 136,
          cost: 0.33,
          model: "claude-sonnet-5.5",
          finishReason: "stop",
        });
        session.finish();
        await run;

        expect(chunks.map(text)).toEqual(["", "Hel", "lo", ""]);
        expect(chunks[0].additional_kwargs.reasoning_content).toBe("Thinking");
        expect(chunks.some((chunk) => text(chunk).includes("ignored"))).toBe(false);
        expect(chunks[3].usage_metadata).toEqual({
          input_tokens: 113,
          output_tokens: 136,
          total_tokens: 249,
        });
        expect(chunks[3].response_metadata).toMatchObject({
          finish_reason: "stop",
          copilot_multiplier: 0.33,
        });
        expect(fake.closes).toHaveBeenCalledTimes(1);
      });

      it("opens a tool-free session that replaces Copilot's system prompt and asks for a supported effort and tier, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const fake = fakeBackend();
        const model = createModel(fake.backend, {
          thinkingLevel: "max",
          contextWindow: "long_context",
          requestTimeoutMs: 1234,
        });

        const run = model.invoke([new SystemMessage("Be brief."), new HumanMessage("Hi")]);
        await nextTick();
        fake.sessions[0].finish();
        await run;

        const config = fake.configs[0] as Record<string, unknown>;
        expect(config).toMatchObject({
          model: "claude-sonnet-5.5",
          reasoningEffort: "high",
          contextTier: "long_context",
          availableTools: [],
          streaming: true,
          systemMessage: { mode: "replace", content: "Be brief." },
        });
        expect((config.onPermissionRequest as () => unknown)()).toEqual({ kind: "reject" });
        expect(fake.sessions[0].sends).toEqual([
          { options: { prompt: "Hi", attachments: [] }, timeout: 1234 },
        ]);
      });
    });

    describe("_generate()", () => {
      it("returns the whole answer with its reasoning and usage when invoked", async () => {
        const fake = fakeBackend();
        const model = createModel(fake.backend);

        const run = model.invoke([new HumanMessage("Hi")]);
        await nextTick();
        const session = fake.sessions[0];
        session.emit("assistant.reasoning_delta", { deltaContent: "Hmm" });
        session.emit("assistant.message_delta", { deltaContent: "Hello" });
        session.emit("assistant.usage", { inputTokens: 1, outputTokens: 2 });
        session.finish();
        const message = await run;

        expect(message.content).toBe("Hello");
        expect(message.additional_kwargs.reasoning_content).toBe("Hmm");
        expect(message.usage_metadata).toEqual({
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
        });
      });
    });

    describe("request lifecycle", () => {
      it("opens no session when the request is already stopped", async () => {
        const fake = fakeBackend();
        const controller = new AbortController();
        controller.abort();

        await expect(
          createModel(fake.backend).invoke([new HumanMessage("Hi")], {
            signal: controller.signal,
          })
        ).rejects.toThrow();
        expect(fake.backend.openSession).not.toHaveBeenCalled();
      });

      it("never sends when stopped while the session was opening, and still deletes the session, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const fake = fakeBackend();
        let release: () => void = () => undefined;
        fake.holdOpen(new Promise<void>((resolve) => (release = resolve)));
        const controller = new AbortController();

        const run = createModel(fake.backend)
          .stream([new HumanMessage("Hi")], { signal: controller.signal })
          .then(async (stream) => {
            for await (const chunk of stream) void chunk;
          });
        await nextTick();
        controller.abort();
        release();

        await expect(run).rejects.toThrow();
        expect(fake.sessions[0].sendAndWait).not.toHaveBeenCalled();
        expect(fake.closes).toHaveBeenCalledTimes(1);
      });

      it("stops only its own session when aborted mid-stream, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const fake = fakeBackend();
        const model = createModel(fake.backend);
        const controller = new AbortController();
        const received: string[] = [];

        const stopped = (async () => {
          for await (const chunk of await model.stream([new HumanMessage("A")], {
            signal: controller.signal,
          })) {
            received.push(text(chunk));
          }
        })();
        const other = model.invoke([new HumanMessage("B")]);
        await nextTick();
        const [first, second] = fake.sessions;
        first.emit("assistant.message_delta", { deltaContent: "partial" });
        await nextTick();
        controller.abort();

        await expect(stopped).rejects.toMatchObject({ name: "AbortError" });
        expect(received).toEqual(["partial"]);
        expect(first.abort).toHaveBeenCalledTimes(1);
        expect(second.abort).not.toHaveBeenCalled();

        second.emit("assistant.message_delta", { deltaContent: "fine" });
        second.finish();
        await expect(other).resolves.toMatchObject({ content: "fine" });
      });

      it("surfaces a failed run without sending the request again, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        const fake = fakeBackend();
        const model = createModel(fake.backend);

        const run = model.invoke([new HumanMessage("Hi")]);
        await nextTick();
        fake.sessions[0].reject(new Error("Connection is closed."));

        await expect(run).rejects.toThrow("Connection is closed.");
        expect(fake.backend.openSession).toHaveBeenCalledTimes(1);
        expect(fake.sessions[0].sendAndWait).toHaveBeenCalledTimes(1);
        expect(fake.closes).toHaveBeenCalledTimes(1);
      });

      it("surfaces a timeout and still deletes the session", async () => {
        const fake = fakeBackend();
        const run = createModel(fake.backend).invoke([new HumanMessage("Hi")]);
        await nextTick();
        fake.sessions[0].reject(new Error("Timeout after 600000ms waiting for session.idle"));

        await expect(run).rejects.toThrow("Timeout");
        expect(fake.closes).toHaveBeenCalledTimes(1);
      });

      it("refuses on mobile or before the CLI client exists, with a desktop-only message, for https://github.com/spectre009/obsidian-copilot/issues/3", async () => {
        await expect(createModel(null).invoke([new HumanMessage("Hi")])).rejects.toThrow(
          "need the Obsidian desktop app"
        );
        jest.mocked(isDesktopRuntime).mockReturnValueOnce(false);
        const fake = fakeBackend();
        await expect(createModel(fake.backend).invoke([new HumanMessage("Hi")])).rejects.toThrow(
          "need the Obsidian desktop app"
        );
        expect(fake.backend.openSession).not.toHaveBeenCalled();
      });

      it("shows a notice for images the model can't read", async () => {
        const fake = fakeBackend();
        const notify = jest.fn();
        const run = createModel(fake.backend, { notify }).invoke([
          new HumanMessage({
            content: [
              { type: "text", text: "Describe" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
            ],
          }),
        ]);
        await nextTick();
        fake.sessions[0].finish();
        await run;

        expect(notify).toHaveBeenCalledWith(
          "Claude Sonnet 5.5 can't read images, so 1 image(s) were not sent. Choose a model with vision to include them."
        );
      });
    });

    describe("_llmType()", () => {
      it("identifies the GitHub Copilot provider and offers no native tool calling", () => {
        const model = createModel(null);

        expect(model._llmType()).toBe("github-copilot");
        expect(typeof (model as { bindTools?: unknown }).bindTools).toBe("undefined");
      });
    });
  });
});
