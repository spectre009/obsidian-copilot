import type { ContextTier, ModelInfo as SdkModelInfo, SessionConfig } from "@github/copilot-sdk";
import type { ModelInfo } from "@/modelManagement";
import type {
  GitHubCopilotContextWindow,
  GitHubCopilotThinkingLevel,
} from "@/settings/githubCopilotQuickChatSettings";

type ReasoningEffort = NonNullable<SessionConfig["reasoningEffort"]>;

const EFFORT_ORDER: readonly ReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"];

export interface GitHubCopilotVisionLimits {
  supportedMediaTypes: readonly string[];
  maxImages: number;
  maxImageBytes: number;
}

/**
 * Converts the CLI's model metadata into the persisted model row Quick Chat reads, so the picker,
 * capability badges and context window work before any request is made.
 * Every Copilot model may stream reasoning (Claude Haiku 4.5 does even though its effort is not
 * configurable), so reasoning display is on for all of them and effort levels are listed only
 * where the model accepts them. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param model one entry of the CLI's model list
 */
export function toConfiguredModelInfo(model: SdkModelInfo): ModelInfo {
  const limits = model.capabilities?.limits;
  const vision = model.capabilities?.supports?.vision === true;
  const efforts = model.capabilities?.supports?.reasoningEffort
    ? model.supportedReasoningEfforts
    : undefined;
  return {
    id: model.id,
    displayName: model.name || model.id,
    modalities: { input: vision ? ["text", "image"] : ["text"], output: ["text"] },
    limits: {
      context: limits?.max_context_window_tokens,
      output: limits?.max_output_tokens,
      input: limits?.max_prompt_tokens,
    },
    reasoning: true,
    reasoningEfforts: efforts && efforts.length > 0 ? [...efforts] : undefined,
  };
}

/**
 * Maps a thinking-level setting to an effort the model accepts: the highest supported level at or
 * below the request, else the lowest it supports. Models without configurable effort get none, so
 * the request never fails on an unsupported value.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param level the user's thinking-level setting
 * @param model the selected model's metadata, when known
 */
export function resolveReasoningEffort(
  level: GitHubCopilotThinkingLevel,
  model: SdkModelInfo | undefined
): ReasoningEffort | undefined {
  if (level === "default" || !model?.capabilities?.supports?.reasoningEffort) return undefined;
  const supported = model.supportedReasoningEfforts ?? [];
  if (supported.includes(level)) return level;
  const requested = EFFORT_ORDER.indexOf(level);
  const atOrBelow = EFFORT_ORDER.slice(0, requested + 1)
    .reverse()
    .find((effort) => supported.includes(effort));
  return atOrBelow ?? EFFORT_ORDER.find((effort) => supported.includes(effort));
}

interface TierPrices {
  maxPromptTokens?: number;
}

interface ContextTierMetadata {
  billing?: { tokenPrices?: TierPrices & { longContext?: TierPrices } };
  supportedContextTiers?: string[];
}

/** Whether the model offers the long-context tier, as advertised by its pricing or tier list. https://github.com/spectre009/obsidian-copilot/issues/3 */
export function supportsLongContext(model: SdkModelInfo | undefined): boolean {
  if (!model) return false;
  const meta = model as unknown as ContextTierMetadata;
  return (
    !!meta.billing?.tokenPrices?.longContext ||
    (meta.supportedContextTiers?.includes("long_context") ?? false)
  );
}

/**
 * Maps the context-window setting to a tier the model accepts; long context falls back to the
 * default tier on models that don't offer it.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param window the user's context-window setting
 * @param model the selected model's metadata, when known
 */
export function resolveContextTier(
  window: GitHubCopilotContextWindow,
  model: SdkModelInfo | undefined
): ContextTier | undefined {
  return window === "long_context" && supportsLongContext(model) ? "long_context" : undefined;
}

/**
 * How many prompt tokens a session with this model and setting accepts. The CLI prices each
 * context tier with its own prompt limit, while the model's capability limits describe its largest
 * tier, so a model offering long context accepts far less on the default tier than its capabilities
 * suggest. The tier's limit wins, capped by the model's overall prompt limit.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param window the user's context-window setting
 * @param model the selected model's metadata, when known
 */
export function promptBudgetTokens(
  window: GitHubCopilotContextWindow,
  model: SdkModelInfo | undefined
): number | undefined {
  if (!model) return undefined;
  const limits = model.capabilities?.limits;
  const overall = limits?.max_prompt_tokens ?? limits?.max_context_window_tokens;
  const prices = (model as unknown as ContextTierMetadata).billing?.tokenPrices;
  const tier = resolveContextTier(window, model) === "long_context" ? prices?.longContext : prices;
  const tierLimit = tier?.maxPromptTokens;
  if (tierLimit === undefined) return overall;
  return overall === undefined ? tierLimit : Math.min(tierLimit, overall);
}

/**
 * The image limits a model enforces, or null when it doesn't accept images.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param model the selected model's metadata, when known
 */
export function visionLimits(model: SdkModelInfo | undefined): GitHubCopilotVisionLimits | null {
  if (!model?.capabilities?.supports?.vision) return null;
  const vision = model.capabilities.limits?.vision;
  return {
    supportedMediaTypes: vision?.supported_media_types ?? [],
    maxImages: vision?.max_prompt_images ?? Number.POSITIVE_INFINITY,
    maxImageBytes: vision?.max_prompt_image_size ?? Number.POSITIVE_INFINITY,
  };
}
