import type CopilotPlugin from "@/main";
import { useSettingsValue } from "@/settings/model";
import type { App } from "obsidian";
import React from "react";
import { updateGitHubCopilotFields } from "./descriptor";
import { GitHubCopilotEnvSettings } from "./ui/GitHubCopilotEnvSettings";

interface Props {
  plugin: CopilotPlugin;
  app: App;
}

export const GitHubCopilotSettingsPanel: React.FC<Props> = () => {
  const settings = useSettingsValue();
  return (
    <GitHubCopilotEnvSettings
      value={settings.agentMode?.backends?.["github-copilot"]?.envOverrides}
      onChange={(next) => updateGitHubCopilotFields({ envOverrides: next })}
    />
  );
};
