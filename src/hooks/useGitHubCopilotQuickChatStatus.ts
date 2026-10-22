import type { ModelInfo as SdkModelInfo } from "@github/copilot-sdk";
import { useEffect, useState } from "react";

import { err2String } from "@/errorFormat";
import { getGitHubCopilotSdkClient } from "@/LLMProviders/githubCopilot/githubCopilotClientRegistry";
import type { GitHubCopilotAccountStatus } from "@/settings/v2/components/ui/GitHubCopilotQuickChatSettings";

const DESKTOP_ONLY: GitHubCopilotAccountStatus = Object.freeze({
  kind: "unavailable",
  message: "GitHub Copilot models need the Obsidian desktop app.",
});
const CHECKING: GitHubCopilotAccountStatus = Object.freeze({ kind: "checking" });

/**
 * The GitHub account Quick Chat's requests bill, read from the running CLI, so a switch of the
 * CLI's or GitHub CLI's active account is visible in settings.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
export function useGitHubCopilotAccount(): GitHubCopilotAccountStatus {
  const [status, setStatus] = useState<GitHubCopilotAccountStatus>(() =>
    getGitHubCopilotSdkClient() ? CHECKING : DESKTOP_ONLY
  );
  useEffect(() => {
    const client = getGitHubCopilotSdkClient();
    if (!client) return;
    let cancelled = false;
    client
      .getAccount()
      .then((account) => {
        if (cancelled) return;
        setStatus(
          account.authenticated && account.login
            ? { kind: "signed-in", login: account.login, host: account.host }
            : { kind: "signed-out", message: account.message }
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus({ kind: "unavailable", message: err2String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

/**
 * The CLI's metadata for one GitHub Copilot model, for showing its context windows.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param modelId the model id, or undefined when Quick Chat isn't using a GitHub Copilot model
 */
export function useGitHubCopilotModel(modelId: string | undefined): SdkModelInfo | undefined {
  const [model, setModel] = useState<SdkModelInfo | undefined>(undefined);
  useEffect(() => {
    const client = getGitHubCopilotSdkClient();
    if (!client || !modelId) return;
    let cancelled = false;
    client
      .getModel(modelId)
      .then((info) => {
        if (!cancelled) setModel(info);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [modelId]);
  return modelId ? model : undefined;
}
