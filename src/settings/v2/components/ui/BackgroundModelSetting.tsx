import { SettingItem } from "@/components/ui/setting-item";
import { SettingSection } from "@/components/ui/setting-section";
import type { GitHubCopilotThinkingLevel } from "@/settings/githubCopilotQuickChatSettings";
import { THINKING_LEVEL_OPTIONS } from "@/settings/v2/components/ui/GitHubCopilotQuickChatSettings";
import React from "react";

export const SAME_AS_CHAT_MODEL = "__same_as_chat_model__";

export interface BackgroundModelSettingProps {
  /** A Quick Chat model id, or SAME_AS_CHAT_MODEL. https://github.com/spectre009/obsidian-copilot/issues/3 */
  value: string;
  options: ReadonlyArray<{ label: string; value: string }>;
  onChange: (value: string) => void;
  thinkingLevel: GitHubCopilotThinkingLevel;
  onThinkingLevelChange: (level: GitHubCopilotThinkingLevel) => void;
}

/**
 * Picks the model Quick Chat uses for query expansion, chat titles and conversation summaries, so
 * those frequent calls can run on a cheaper model than the chat.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
export const BackgroundModelSetting: React.FC<BackgroundModelSettingProps> = ({
  value,
  options,
  onChange,
  thinkingLevel,
  onThinkingLevelChange,
}) => (
  <SettingSection>
    <div className="tw-flex tw-min-w-0 tw-flex-col tw-py-4">
      <span className="tw-text-base tw-font-semibold">Background model</span>
      <span className="tw-text-xs tw-text-muted">
        Runs query expansion on each vault search, a title for each new chat and a summary of each
        finished chat. Context compaction stays on the chat model.
      </span>
    </div>
    <SettingItem
      type="select"
      title="Background model"
      description="Pick from your enabled Quick Chat models. A model that is turned off falls back to the chat model."
      value={value}
      onChange={onChange}
      options={[{ label: "Same as chat model", value: SAME_AS_CHAT_MODEL }, ...options]}
    />
    <SettingItem
      type="select"
      title="Background thinking level"
      description="Applies when the background model is a GitHub Copilot model."
      value={thinkingLevel}
      onChange={(level) => onThinkingLevelChange(level as GitHubCopilotThinkingLevel)}
      options={[...THINKING_LEVEL_OPTIONS]}
    />
  </SettingSection>
);
