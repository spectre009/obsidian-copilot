import type { ModelInfo as SdkModelInfo } from "@github/copilot-sdk";
import {
  promptBudgetTokens,
  resolveContextTier,
  resolveReasoningEffort,
  supportsLongContext,
  toConfiguredModelInfo,
  visionLimits,
} from "./githubCopilotModels";

function sdkModel(overrides: Partial<SdkModelInfo> & { billing?: unknown } = {}): SdkModelInfo {
  return {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    capabilities: {
      supports: { vision: true, reasoningEffort: true },
      limits: {
        max_prompt_tokens: 168000,
        max_output_tokens: 32000,
        max_context_window_tokens: 200000,
        vision: {
          supported_media_types: ["image/png", "image/jpeg"],
          max_prompt_images: 5,
          max_prompt_image_size: 3145728,
        },
      },
    },
    supportedReasoningEfforts: ["low", "medium", "high"],
    ...overrides,
  };
}

const HAIKU = sdkModel({
  id: "claude-haiku-4.5",
  name: "Claude Haiku 4.5",
  capabilities: {
    supports: { vision: true, reasoningEffort: false },
    limits: { max_prompt_tokens: 128000, max_context_window_tokens: 144000 },
  },
  supportedReasoningEfforts: undefined,
});

const LONG_CONTEXT_MODEL = sdkModel({
  id: "claude-haiku-5.5",
  capabilities: {
    supports: { vision: true, reasoningEffort: true },
    limits: { max_prompt_tokens: 936000, max_context_window_tokens: 1000000 },
  },
  billing: {
    tokenPrices: { maxPromptTokens: 100000, longContext: { maxPromptTokens: 936000 } },
  },
});

describe("githubCopilotModels", () => {
  describe("toConfiguredModelInfo()", () => {
    it("maps the CLI's limits, vision and effort levels onto the persisted model row", () => {
      expect(toConfiguredModelInfo(sdkModel())).toEqual({
        id: "claude-sonnet-5.5",
        displayName: "Claude Sonnet 5.5",
        modalities: { input: ["text", "image"], output: ["text"] },
        limits: { context: 200000, output: 32000, input: 168000 },
        reasoning: true,
        reasoningEfforts: ["low", "medium", "high"],
      });
    });

    it("keeps reasoning display on but lists no effort levels for a model whose effort is fixed, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      const info = toConfiguredModelInfo(HAIKU);

      expect(info.reasoning).toBe(true);
      expect(info.reasoningEfforts).toBeUndefined();
    });

    it("marks a model without vision as text-only and falls back to the id for a missing name", () => {
      const info = toConfiguredModelInfo(
        sdkModel({
          name: "",
          capabilities: {
            supports: { vision: false, reasoningEffort: false },
            limits: { max_context_window_tokens: 64000 },
          },
        })
      );

      expect(info.displayName).toBe("claude-sonnet-5.5");
      expect(info.modalities?.input).toEqual(["text"]);
    });
  });

  describe("resolveReasoningEffort()", () => {
    it("sends no effort for the model-default level", () => {
      expect(resolveReasoningEffort("default", sdkModel())).toBeUndefined();
    });

    it("passes a supported level through unchanged", () => {
      expect(resolveReasoningEffort("medium", sdkModel())).toBe("medium");
    });

    it("clamps an unsupported level to the highest supported level below it, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      expect(resolveReasoningEffort("max", sdkModel())).toBe("high");
    });

    it("raises a level below every supported one to the lowest supported level, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      expect(
        resolveReasoningEffort("low", sdkModel({ supportedReasoningEfforts: ["high", "max"] }))
      ).toBe("high");
    });

    it("sends no effort to a model whose effort isn't configurable or isn't known, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      expect(resolveReasoningEffort("high", HAIKU)).toBeUndefined();
      expect(resolveReasoningEffort("high", undefined)).toBeUndefined();
    });
  });

  describe("supportsLongContext()", () => {
    it("reads long-context support from the model's long-context pricing or tier list", () => {
      expect(supportsLongContext(LONG_CONTEXT_MODEL)).toBe(true);
      expect(
        supportsLongContext({
          ...sdkModel(),
          supportedContextTiers: ["default", "long_context"],
        } as unknown as SdkModelInfo)
      ).toBe(true);
    });

    it("reports no long context for a model without it or an unknown model", () => {
      expect(supportsLongContext(sdkModel())).toBe(false);
      expect(supportsLongContext(undefined)).toBe(false);
    });
  });

  describe("resolveContextTier()", () => {
    it("asks for long context only on models that offer it, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      expect(resolveContextTier("long_context", LONG_CONTEXT_MODEL)).toBe("long_context");
      expect(resolveContextTier("long_context", sdkModel())).toBeUndefined();
      expect(resolveContextTier("default", LONG_CONTEXT_MODEL)).toBeUndefined();
    });
  });

  describe("promptBudgetTokens()", () => {
    it("uses the default tier's prompt limit rather than the larger capability limit, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      expect(promptBudgetTokens("default", LONG_CONTEXT_MODEL)).toBe(100000);
    });

    it("uses the long-context tier's prompt limit when long context applies", () => {
      expect(promptBudgetTokens("long_context", LONG_CONTEXT_MODEL)).toBe(936000);
    });

    it("caps a tier limit above the model's overall prompt limit, for https://github.com/spectre009/obsidian-copilot/issues/3", () => {
      const grok = sdkModel({
        capabilities: {
          supports: { vision: true, reasoningEffort: true },
          limits: { max_prompt_tokens: 372000, max_context_window_tokens: 500000 },
        },
        billing: {
          tokenPrices: { maxPromptTokens: 200000, longContext: { maxPromptTokens: 500000 } },
        },
      });

      expect(promptBudgetTokens("long_context", grok)).toBe(372000);
    });

    it("falls back to the capability prompt limit for a model without tier pricing or with long context unavailable", () => {
      expect(promptBudgetTokens("default", sdkModel())).toBe(168000);
      expect(promptBudgetTokens("long_context", HAIKU)).toBe(128000);
    });

    it("reports no budget for an unknown model", () => {
      expect(promptBudgetTokens("default", undefined)).toBeUndefined();
    });
  });

  describe("visionLimits()", () => {
    it("returns the model's image limits, or null for a model that can't read images", () => {
      expect(visionLimits(sdkModel())).toEqual({
        supportedMediaTypes: ["image/png", "image/jpeg"],
        maxImages: 5,
        maxImageBytes: 3145728,
      });
      expect(
        visionLimits(
          sdkModel({
            capabilities: {
              supports: { vision: false, reasoningEffort: false },
              limits: { max_context_window_tokens: 1 },
            },
          })
        )
      ).toBeNull();
    });

    it("treats missing image limits as unlimited", () => {
      expect(visionLimits(HAIKU)).toEqual({
        supportedMediaTypes: [],
        maxImages: Number.POSITIVE_INFINITY,
        maxImageBytes: Number.POSITIVE_INFINITY,
      });
    });
  });
});
