import { SettingItem } from "@/components/ui/setting-item";
import { SettingSection } from "@/components/ui/setting-section";
import type {
  GitHubCopilotContextWindow,
  GitHubCopilotThinkingLevel,
} from "@/settings/githubCopilotQuickChatSettings";
import React from "react";

export type GitHubCopilotAccountStatus =
  | { kind: "checking" }
  | { kind: "signed-in"; login: string; host?: string }
  | { kind: "signed-out"; message?: string }
  | { kind: "unavailable"; message: string };

export interface GitHubCopilotModelWindow {
  modelLabel: string;
  defaultTokens?: number;
  longContextTokens?: number;
}

export const THINKING_LEVEL_OPTIONS: ReadonlyArray<{
  label: string;
  value: GitHubCopilotThinkingLevel;
}> = [
  { label: "Model default", value: "default" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra high", value: "xhigh" },
  { label: "Max", value: "max" },
];

export const CONTEXT_WINDOW_OPTIONS: ReadonlyArray<{
  label: string;
  value: GitHubCopilotContextWindow;
}> = [
  { label: "Default", value: "default" },
  { label: "Long context", value: "long_context" },
];

export interface GitHubCopilotQuickChatSettingsProps {
  account: GitHubCopilotAccountStatus;
  thinkingLevel: GitHubCopilotThinkingLevel;
  onThinkingLevelChange: (level: GitHubCopilotThinkingLevel) => void;
  contextWindow: GitHubCopilotContextWindow;
  onContextWindowChange: (window: GitHubCopilotContextWindow) => void;
  /** The prompt tokens the selected Quick Chat model accepts on each tier, when it is a GitHub Copilot model. https://github.com/spectre009/obsidian-copilot/issues/3 */
  modelWindow?: GitHubCopilotModelWindow;
}

function formatTokens(tokens: number): string {
  return `${tokens.toLocaleString("en-US")} prompt tokens`;
}

function AccountLine({ account }: { account: GitHubCopilotAccountStatus }) {
  switch (account.kind) {
    case "checking":
      return <>Checking the GitHub Copilot sign-in…</>;
    case "signed-in":
      return (
        <>
          Signed in as <span className="tw-font-medium tw-text-normal">{account.login}</span>
          {account.host ? ` on ${account.host.replace(/^https?:\/\//, "")}` : ""}. Requests bill
          this account&apos;s Copilot plan.
        </>
      );
    case "signed-out":
      return (
        <>
          Not signed in{account.message ? `: ${account.message}` : ""}. Run{" "}
          <code>copilot login</code> in a terminal.
        </>
      );
    case "unavailable":
      return <>{account.message}</>;
  }
}

function contextWindowDescription(modelWindow: GitHubCopilotModelWindow | undefined): string {
  const base = "Long context is used only on models that offer it, at their long-context price.";
  if (!modelWindow?.defaultTokens) return base;
  const longPart = modelWindow.longContextTokens
    ? ` Long context: ${formatTokens(modelWindow.longContextTokens)}.`
    : " It doesn't offer long context.";
  return `${modelWindow.modelLabel}: ${formatTokens(modelWindow.defaultTokens)}.${longPart} ${base}`;
}

/**
 * Quick Chat's controls for GitHub Copilot models: the account requests bill, and the thinking
 * level and context window each request asks for. https://github.com/spectre009/obsidian-copilot/issues/3
 */
export const GitHubCopilotQuickChatSettings: React.FC<GitHubCopilotQuickChatSettingsProps> = ({
  account,
  thinkingLevel,
  onThinkingLevelChange,
  contextWindow,
  onContextWindowChange,
  modelWindow,
}) => (
  <SettingSection>
    <div className="tw-flex tw-min-w-0 tw-flex-col tw-gap-1 tw-py-4">
      <span className="tw-text-base tw-font-semibold">GitHub Copilot</span>
      <span className="tw-text-xs tw-text-muted">
        <AccountLine account={account} /> The account is the one the GitHub Copilot CLI is signed in
        to, or the GitHub CLI&apos;s active account.
      </span>
    </div>
    <SettingItem
      type="select"
      title="Thinking level"
      description="How much GitHub Copilot models reason before answering. Models that don't accept the level get the nearest one they support."
      value={thinkingLevel}
      onChange={(value) => onThinkingLevelChange(value as GitHubCopilotThinkingLevel)}
      options={[...THINKING_LEVEL_OPTIONS]}
    />
    <SettingItem
      type="select"
      title="Context window"
      description={contextWindowDescription(modelWindow)}
      value={contextWindow}
      onChange={(value) => onContextWindowChange(value as GitHubCopilotContextWindow)}
      options={[...CONTEXT_WINDOW_OPTIONS]}
    />
  </SettingSection>
);
