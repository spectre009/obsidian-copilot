import type { BaseMessage } from "@langchain/core/messages";
import type { GitHubCopilotVisionLimits } from "./githubCopilotModels";

export interface GitHubCopilotBlobAttachment {
  type: "blob";
  data: string;
  mimeType: string;
}

export interface GitHubCopilotPrompt {
  systemMessage: string;
  prompt: string;
  attachments: GitHubCopilotBlobAttachment[];
  /** User-facing explanations for images that were not sent. https://github.com/spectre009/obsidian-copilot/issues/3 */
  notices: string[];
}

export interface GitHubCopilotPromptOptions {
  modelLabel: string;
  vision: GitHubCopilotVisionLimits | null;
  /** Converts a non-data image URL to a data URL, or null when it can't be read. https://github.com/spectre009/obsidian-copilot/issues/3 */
  resolveImageUrl: (url: string) => Promise<string | null>;
}

/** A conversation layout this adapter cannot express as one GitHub Copilot prompt. https://github.com/spectre009/obsidian-copilot/issues/3 */
export class GitHubCopilotTranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubCopilotTranscriptError";
  }
}

const HISTORY_TAG = "conversation_history";
const TURN_TAG = "turn";
const OWN_TAG_PATTERN = new RegExp(`<(/?)(${HISTORY_TAG}|${TURN_TAG})\\b`, "gi");
const THINK_BLOCK_PATTERN = /<think>[\s\S]*?<\/think>|<think>[\s\S]*$/g;
const DATA_URL_PATTERN = /^data:([^;,]+);base64,([\s\S]*)$/;
const IMAGE_PLACEHOLDER = "[image omitted]";

type ContentPart = Record<string, unknown> & { type?: unknown };

interface ImageRef {
  url?: string;
  data?: string;
  mimeType?: string;
}

function messageType(message: BaseMessage): string {
  return message.type;
}

function contentParts(message: BaseMessage): ContentPart[] {
  const content = message.content as unknown;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? (content as ContentPart[]) : [];
}

function imageRef(part: ContentPart): ImageRef | null {
  if (part.type === "image_url") {
    const imageUrl = part.image_url;
    const url = typeof imageUrl === "string" ? imageUrl : (imageUrl as { url?: unknown })?.url;
    return typeof url === "string" ? { url } : null;
  }
  if (part.type === "image") {
    const data = typeof part.data === "string" ? part.data : undefined;
    const mimeType =
      typeof part.mimeType === "string"
        ? part.mimeType
        : typeof part.mime_type === "string"
          ? part.mime_type
          : undefined;
    if (data && mimeType) return { data, mimeType };
    return typeof part.url === "string" ? { url: part.url } : null;
  }
  return null;
}

function textOf(part: ContentPart): string | null {
  return part.type === "text" && typeof part.text === "string" ? part.text : null;
}

// Earlier turns are quoted inside our own tags, so their text must not be able to open or close
// one. https://github.com/spectre009/obsidian-copilot/issues/3
function escapeOwnTags(text: string): string {
  return text.replace(OWN_TAG_PATTERN, "&lt;$1$2");
}

function renderHistoryText(message: BaseMessage, role: "user" | "assistant"): string {
  const pieces: string[] = [];
  for (const part of contentParts(message)) {
    const text = textOf(part);
    if (text !== null) pieces.push(text);
    else if (imageRef(part)) pieces.push(IMAGE_PLACEHOLDER);
  }
  const joined = pieces.join("\n");
  const visible = role === "assistant" ? joined.replace(THINK_BLOCK_PATTERN, "") : joined;
  return escapeOwnTags(visible.trim());
}

function assertNoToolLayout(message: BaseMessage): void {
  const type = messageType(message);
  const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;
  if (type === "tool" || type === "function" || (Array.isArray(toolCalls) && toolCalls.length)) {
    throw new GitHubCopilotTranscriptError(
      "GitHub Copilot models in Quick Chat can't call tools, so this conversation can't be sent."
    );
  }
}

function historyRole(message: BaseMessage): "user" | "assistant" {
  const type = messageType(message);
  if (type === "human") return "user";
  if (type === "ai") return "assistant";
  throw new GitHubCopilotTranscriptError(
    `GitHub Copilot models can't send a "${type}" message in Quick Chat.`
  );
}

function decodedByteLength(base64: string): number {
  const trimmed = base64.replace(/\s/g, "");
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.floor((trimmed.length * 3) / 4) - padding;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

async function toBlob(
  ref: ImageRef,
  resolveImageUrl: GitHubCopilotPromptOptions["resolveImageUrl"]
): Promise<GitHubCopilotBlobAttachment | null> {
  if (ref.data && ref.mimeType) return { type: "blob", data: ref.data, mimeType: ref.mimeType };
  if (!ref.url) return null;
  const dataUrl = ref.url.startsWith("data:") ? ref.url : await resolveImageUrl(ref.url);
  const match = dataUrl?.match(DATA_URL_PATTERN);
  return match ? { type: "blob", data: match[2], mimeType: match[1].toLowerCase() } : null;
}

async function finalTurnAttachments(
  refs: readonly ImageRef[],
  options: GitHubCopilotPromptOptions,
  notices: string[]
): Promise<GitHubCopilotBlobAttachment[]> {
  if (refs.length === 0) return [];
  const { vision, modelLabel } = options;
  if (!vision) {
    notices.push(
      `${modelLabel} can't read images, so ${refs.length} image(s) were not sent. Choose a model with vision to include them.`
    );
    return [];
  }
  const accepted: GitHubCopilotBlobAttachment[] = [];
  let unreadable = 0;
  for (const ref of refs) {
    const blob = await toBlob(ref, options.resolveImageUrl);
    if (!blob) {
      unreadable += 1;
      continue;
    }
    if (
      vision.supportedMediaTypes.length > 0 &&
      !vision.supportedMediaTypes.includes(blob.mimeType)
    ) {
      notices.push(`${modelLabel} doesn't accept ${blob.mimeType} images, so one was not sent.`);
      continue;
    }
    if (decodedByteLength(blob.data) > vision.maxImageBytes) {
      notices.push(
        `An image is larger than ${modelLabel}'s ${formatBytes(vision.maxImageBytes)} limit, so it was not sent.`
      );
      continue;
    }
    if (accepted.length >= vision.maxImages) {
      notices.push(
        `${modelLabel} accepts at most ${vision.maxImages} image(s) per message; the rest were not sent.`
      );
      break;
    }
    accepted.push(blob);
  }
  if (unreadable > 0) notices.push(`${unreadable} image(s) couldn't be read and were not sent.`);
  return accepted;
}

/**
 * Renders a LangChain conversation as one GitHub Copilot request. The SDK accepts a single prompt
 * per session, so system messages replace Copilot's system prompt, earlier turns are quoted in
 * order inside tagged blocks, and only the final user message carries images. Role fidelity for
 * earlier turns is therefore approximate. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param messages the normalized conversation, ending with the user's message
 * @param options the target model's label and image limits, and how to read non-data image URLs
 */
export async function buildGitHubCopilotPrompt(
  messages: readonly BaseMessage[],
  options: GitHubCopilotPromptOptions
): Promise<GitHubCopilotPrompt> {
  messages.forEach(assertNoToolLayout);
  const systemTexts: string[] = [];
  const turns: BaseMessage[] = [];
  for (const message of messages) {
    if (messageType(message) === "system") {
      const text = contentParts(message)
        .map(textOf)
        .filter((t): t is string => t !== null)
        .join("\n");
      if (text.trim()) systemTexts.push(text);
    } else {
      turns.push(message);
    }
  }

  const final = turns.pop();
  if (!final || messageType(final) !== "human") {
    throw new GitHubCopilotTranscriptError(
      "GitHub Copilot models need the conversation to end with your message."
    );
  }

  const history = turns.map((message) => {
    const role = historyRole(message);
    return `<${TURN_TAG} role="${role}">\n${renderHistoryText(message, role)}\n</${TURN_TAG}>`;
  });

  const finalTexts: string[] = [];
  const finalImages: ImageRef[] = [];
  for (const part of contentParts(final)) {
    const text = textOf(part);
    if (text !== null) finalTexts.push(text);
    else {
      const ref = imageRef(part);
      if (ref) finalImages.push(ref);
    }
  }

  const notices: string[] = [];
  const attachments = await finalTurnAttachments(finalImages, options, notices);
  const finalText = finalTexts.join("\n").trim();
  if (!finalText && attachments.length === 0) {
    throw new GitHubCopilotTranscriptError(
      finalImages.length > 0
        ? `${options.modelLabel} can't read the attached image(s). Add a question or choose a model with vision.`
        : "There is no message to send."
    );
  }

  const prompt =
    history.length > 0
      ? `<${HISTORY_TAG}>\n${history.join("\n")}\n</${HISTORY_TAG}>\n\n${finalText}`
      : finalText;
  return { systemMessage: systemTexts.join("\n\n"), prompt, attachments, notices };
}
