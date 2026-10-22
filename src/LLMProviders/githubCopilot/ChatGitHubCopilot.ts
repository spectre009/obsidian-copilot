import type { SessionEvent } from "@github/copilot-sdk";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import type { UsageMetadata } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { logWarn } from "@/logger";
import type {
  GitHubCopilotContextWindow,
  GitHubCopilotThinkingLevel,
} from "@/settings/githubCopilotQuickChatSettings";
import { isDesktopRuntime } from "@/utils/desktopRuntime";
import { resolveContextTier, resolveReasoningEffort, visionLimits } from "./githubCopilotModels";
import type { GitHubCopilotChatBackend } from "./githubCopilotSdkClient";
import { GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE } from "./githubCopilotSdkLoader";
import { buildGitHubCopilotPrompt } from "./githubCopilotTranscript";

const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export interface ChatGitHubCopilotInput extends BaseChatModelParams {
  modelName: string;
  /** Shown in notices; defaults to the model id. https://github.com/spectre009/obsidian-copilot/issues/3 */
  displayName?: string;
  /** Looked up per request, because Quick Chat's model can be built before the CLI client exists. https://github.com/spectre009/obsidian-copilot/issues/3 */
  getBackend: () => GitHubCopilotChatBackend | null;
  thinkingLevel?: GitHubCopilotThinkingLevel;
  contextWindow?: GitHubCopilotContextWindow;
  requestTimeoutMs?: number;
  /** Converts a non-data image URL to a data URL, or null when it can't be read. https://github.com/spectre009/obsidian-copilot/issues/3 */
  resolveImageUrl?: (url: string) => Promise<string | null>;
  notify?: (message: string) => void;
}

function abortError(): Error {
  const error = new Error("The GitHub Copilot request was stopped.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

/** Bridges callback-style SDK events into an async stream with one terminal outcome. https://github.com/spectre009/obsidian-copilot/issues/3 */
class ChunkQueue {
  readonly #items: ChatGenerationChunk[] = [];
  #waiter: (() => void) | null = null;
  #done = false;
  #error: Error | null = null;

  push(item: ChatGenerationChunk): void {
    if (this.#done) return;
    this.#items.push(item);
    this.#wake();
  }

  close(): void {
    this.#done = true;
    this.#wake();
  }

  fail(error: unknown): void {
    if (this.#done) return;
    this.#error = error instanceof Error ? error : new Error(String(error));
    this.#done = true;
    this.#wake();
  }

  async *drain(): AsyncGenerator<ChatGenerationChunk> {
    for (;;) {
      const error = this.#error;
      if (error) throw error;
      const next = this.#items.shift();
      if (next) {
        yield next;
        continue;
      }
      if (this.#done) return;
      await new Promise<void>((resolve) => (this.#waiter = resolve));
    }
  }

  #wake(): void {
    const waiter = this.#waiter;
    this.#waiter = null;
    waiter?.();
  }
}

function textChunk(text: string): ChatGenerationChunk {
  return new ChatGenerationChunk({ text, message: new AIMessageChunk({ content: text }) });
}

function reasoningChunk(text: string): ChatGenerationChunk {
  return new ChatGenerationChunk({
    text: "",
    message: new AIMessageChunk({ content: "", additional_kwargs: { reasoning_content: text } }),
  });
}

type UsageData = Extract<SessionEvent, { type: "assistant.usage" }>["data"];

function usageChunk(usage: UsageData): ChatGenerationChunk {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const usageMetadata: UsageMetadata = {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
  };
  return new ChatGenerationChunk({
    text: "",
    message: new AIMessageChunk({
      content: "",
      usage_metadata: usageMetadata,
      response_metadata: {
        finish_reason: usage.finishReason ?? "stop",
        model_name: usage.model,
        copilot_multiplier: usage.cost,
      },
    }),
  });
}

/**
 * A LangChain chat model backed by the GitHub Copilot CLI through the official SDK. Each request is
 * a tool-free session whose system prompt replaces Copilot's own, so the model answers as the
 * plugin's assistant and bills the user's Copilot plan at the model's multiplier. It has no
 * `bindTools`: the SDK can't hand tool calls back to the caller.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
export class ChatGitHubCopilot extends BaseChatModel {
  readonly modelName: string;
  readonly #displayName: string;
  readonly #getBackend: () => GitHubCopilotChatBackend | null;
  readonly #thinkingLevel: GitHubCopilotThinkingLevel;
  readonly #contextWindow: GitHubCopilotContextWindow;
  readonly #timeoutMs: number;
  readonly #resolveImageUrl: (url: string) => Promise<string | null>;
  readonly #notify: (message: string) => void;

  constructor(fields: ChatGitHubCopilotInput) {
    super(fields);
    this.modelName = fields.modelName;
    this.#displayName = fields.displayName ?? fields.modelName;
    this.#getBackend = fields.getBackend;
    this.#thinkingLevel = fields.thinkingLevel ?? "default";
    this.#contextWindow = fields.contextWindow ?? "default";
    this.#timeoutMs = fields.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#resolveImageUrl = fields.resolveImageUrl ?? (async () => null);
    this.#notify = fields.notify ?? (() => undefined);
  }

  _llmType(): string {
    return "github-copilot";
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    let text = "";
    let reasoning = "";
    let last: AIMessageChunk | undefined;
    for await (const chunk of this.#request(messages, options, runManager)) {
      const message = chunk.message as AIMessageChunk;
      text += chunk.text;
      const delta = message.additional_kwargs?.reasoning_content;
      if (typeof delta === "string") reasoning += delta;
      if (message.usage_metadata) last = message;
    }
    return {
      generations: [
        {
          text,
          message: new AIMessage({
            content: text,
            additional_kwargs: reasoning ? { reasoning_content: reasoning } : {},
            usage_metadata: last?.usage_metadata,
            response_metadata: last?.response_metadata ?? {},
          }),
        },
      ],
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* this.#request(messages, options, runManager);
  }

  /**
   * The one request primitive behind both generate and stream: open a session, send the prompt,
   * stream deltas until the run settles, and always delete the session. Aborting stops only this
   * session. https://github.com/spectre009/obsidian-copilot/issues/3
   */
  async *#request(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const signal = options.signal;
    throwIfAborted(signal);
    const backend = isDesktopRuntime() ? this.#getBackend() : null;
    if (!backend) throw new Error(GITHUB_COPILOT_DESKTOP_ONLY_MESSAGE);

    const model = await backend.getModel(this.modelName);
    const prompt = await buildGitHubCopilotPrompt(messages, {
      modelLabel: this.#displayName,
      vision: visionLimits(model),
      resolveImageUrl: this.#resolveImageUrl,
    });
    for (const notice of prompt.notices) this.#notify(notice);
    throwIfAborted(signal);

    const lease = await backend.openSession({
      model: this.modelName,
      reasoningEffort: resolveReasoningEffort(this.#thinkingLevel, model),
      contextTier: resolveContextTier(this.#contextWindow, model),
      availableTools: [],
      streaming: true,
      systemMessage: { mode: "replace", content: prompt.systemMessage },
      onPermissionRequest: () => ({ kind: "reject" }),
    });

    const queue = new ChunkQueue();
    let usage: UsageData | undefined;
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const onAbort = (): void => queue.fail(abortError());
    try {
      // The session may have taken a while to open; a stop pressed meanwhile must not send. https://github.com/spectre009/obsidian-copilot/issues/3
      throwIfAborted(signal);
      unsubscribe = lease.session.on((event: SessionEvent) => {
        if (event.agentId) return;
        if (event.type === "assistant.message_delta" && event.data.deltaContent) {
          queue.push(textChunk(event.data.deltaContent));
        } else if (event.type === "assistant.reasoning_delta" && event.data.deltaContent) {
          queue.push(reasoningChunk(event.data.deltaContent));
        } else if (event.type === "assistant.usage") {
          usage = event.data;
        }
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      const run = lease.session
        .sendAndWait({ prompt: prompt.prompt, attachments: prompt.attachments }, this.#timeoutMs)
        .then(
          () => {
            settled = true;
            queue.close();
          },
          (error: unknown) => {
            settled = true;
            queue.fail(error);
          }
        );

      for await (const chunk of queue.drain()) {
        yield chunk;
        if (chunk.text) await runManager?.handleLLMNewToken(chunk.text);
      }
      await run;
      if (usage) yield usageChunk(usage);
    } finally {
      unsubscribe?.();
      signal?.removeEventListener("abort", onAbort);
      if (!settled) {
        await lease.session.abort().catch((error: unknown) => {
          logWarn("[GitHubCopilot] Could not stop a Quick Chat request", error);
        });
      }
      await lease.close();
    }
  }
}
