import type { Meta, StoryObj } from "@/lib/story";
import {
  GitHubCopilotQuickChatSettings,
  type GitHubCopilotQuickChatSettingsProps,
} from "./GitHubCopilotQuickChatSettings";

const meta = {
  title: "Settings/Quick Chat GitHub Copilot",
  component: GitHubCopilotQuickChatSettings,
  args: {
    account: { kind: "signed-in", login: "octocat", host: "https://github.com" },
    thinkingLevel: "default",
    onThinkingLevelChange: () => undefined,
    contextWindow: "default",
    onContextWindowChange: () => undefined,
    modelWindow: {
      modelLabel: "Claude Sonnet 5.5",
      defaultTokens: 200000,
      longContextTokens: 936000,
    },
  },
  parameters: { gallery: { host: "settings-tab", layout: "padded" } },
} satisfies Meta<GitHubCopilotQuickChatSettingsProps>;
export default meta;

export const SignedIn: StoryObj<GitHubCopilotQuickChatSettingsProps> = {};

export const LongContextUnavailable: StoryObj<GitHubCopilotQuickChatSettingsProps> = {
  args: {
    contextWindow: "long_context",
    thinkingLevel: "high",
    modelWindow: { modelLabel: "Claude Haiku 4.5", defaultTokens: 136000 },
  },
};

export const CheckingAccount: StoryObj<GitHubCopilotQuickChatSettingsProps> = {
  args: { account: { kind: "checking" }, modelWindow: undefined },
};

export const SignedOut: StoryObj<GitHubCopilotQuickChatSettingsProps> = {
  args: { account: { kind: "signed-out" }, modelWindow: undefined },
};

export const CliMissing: StoryObj<GitHubCopilotQuickChatSettingsProps> = {
  args: {
    account: {
      kind: "unavailable",
      message:
        "GitHub Copilot CLI not found. Install it, then open Agent Mode settings and run Auto-detect.",
    },
    modelWindow: undefined,
  },
};
