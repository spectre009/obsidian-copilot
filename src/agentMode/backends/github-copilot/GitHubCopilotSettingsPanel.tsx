import type CopilotPlugin from "@/main";
import { useSettingsValue } from "@/settings/model";
import type { App } from "obsidian";
import React from "react";
import { updateGitHubCopilotFields } from "./descriptor";
import { GitHubCopilotContextWindowSetting } from "./ui/GitHubCopilotContextWindowSetting";
import { GitHubCopilotEnvSettings } from "./ui/GitHubCopilotEnvSettings";

interface Props {
  plugin: CopilotPlugin;
  app: App;
}

export const GitHubCopilotSettingsPanel: React.FC<Props> = () => {
  const settings = useSettingsValue();
  const backend = settings.agentMode?.backends?.["github-copilot"];
  return (
    <div className="tw-flex tw-flex-col tw-gap-2">
      <GitHubCopilotContextWindowSetting
        value={backend?.contextWindow}
        onChange={(next) =>
          updateGitHubCopilotFields({ contextWindow: next === "default" ? undefined : next })
        }
      />
      <GitHubCopilotEnvSettings
        value={backend?.envOverrides}
        onChange={(next) => updateGitHubCopilotFields({ envOverrides: next })}
      />
    </div>
  );
};
