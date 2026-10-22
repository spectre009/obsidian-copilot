import { EnvOverridesSetting } from "@/agentMode/backends/shared/EnvOverridesSetting";
import React from "react";

interface Props {
  value: Record<string, string> | undefined;
  onChange: (next: Record<string, string> | undefined) => void;
}

// Naming the variables Copilot sets itself keeps an ignored override from being a surprise.
// https://github.com/spectre009/obsidian-copilot/issues/2
export const GitHubCopilotEnvSettings: React.FC<Props> = ({ value, onChange }) => (
  <div className="tw-flex tw-flex-col">
    <EnvOverridesSetting
      backendDisplayName="GitHub Copilot"
      value={value}
      onChange={onChange}
      hintExamples={["HTTPS_PROXY", "GH_HOST"]}
    />
    <p className="tw-my-0 tw-text-xs tw-text-muted">
      Copilot sets <code>COPILOT_*</code> variables, <code>GH_TOKEN</code>,{" "}
      <code>GITHUB_TOKEN</code> and <code>OTEL_*</code> itself, so overrides for them are ignored.{" "}
      <code>COPILOT_GH_HOST</code> and <code>COPILOT_PROXY_KERBEROS_SPN</code> still apply.
    </p>
  </div>
);
