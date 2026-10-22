import { SettingItem } from "@/components/ui/setting-item";
import type { GitHubCopilotContextWindow } from "@/settings/githubCopilotQuickChatSettings";
import React from "react";

interface Props {
  value: GitHubCopilotContextWindow | undefined;
  onChange: (next: GitHubCopilotContextWindow) => void;
}

// ACP has no per-session context control, so the tier is a launch flag and changing it restarts
// the agent. https://github.com/spectre009/obsidian-copilot/issues/3
export const GitHubCopilotContextWindowSetting: React.FC<Props> = ({ value, onChange }) => (
  <SettingItem
    type="select"
    title="Context window"
    description="Long context applies to models that offer it, at their long-context price. Changing this restarts GitHub Copilot; with a chat open, it applies when you reload."
    value={value ?? "default"}
    onChange={(next) => onChange(next as GitHubCopilotContextWindow)}
    options={[
      { label: "Default", value: "default" },
      { label: "Long context", value: "long_context" },
    ]}
  />
);
