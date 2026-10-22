import { FullBleedReactModal } from "@/components/modals/ReactModal";
import { getSettings, useSettingsValue } from "@/settings/model";
import { validateExecutableFile } from "@/utils/detectBinary";
import { App, Notice } from "obsidian";
import React from "react";
import {
  detectGitHubCopilotCliPath,
  getGitHubCopilotInstallState,
  githubCopilotDetectionSearchDirs,
  githubCopilotSignInCommand,
  refreshGitHubCopilotInstallState,
  resolveGitHubCopilotCliPath,
  subscribeGitHubCopilotInstallState,
  updateGitHubCopilotFields,
} from "./descriptor";
import { isSpawnableGitHubCopilotPath } from "./githubCopilotBinaryResolver";
import { GitHubCopilotConfigView } from "./ui/GitHubCopilotConfigView";

export function githubCopilotInstallCommand(platform: NodeJS.Platform): string {
  if (platform === "win32") return "winget install GitHub.Copilot";
  if (platform === "darwin") return "brew install --cask copilot-cli";
  return "curl -fsSL https://gh.io/copilot-install | bash";
}

export async function validateGitHubCopilotCliPath(
  path: string,
  platform: NodeJS.Platform
): Promise<string | null> {
  if (!isSpawnableGitHubCopilotPath(path, platform)) {
    return "Copilot can't run npm's copilot.cmd or copilot.ps1 launchers. Choose copilot.exe, for example from the WinGet install.";
  }
  return validateExecutableFile(path);
}

const GitHubCopilotConfigContainer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const settings = useSettingsValue();
  const getStateSnapshot = React.useCallback(
    () => getGitHubCopilotInstallState(settings),
    [settings]
  );
  const state = React.useSyncExternalStore(subscribeGitHubCopilotInstallState, getStateSnapshot);
  const override = settings.agentMode?.backends?.["github-copilot"]?.binaryPath;

  React.useEffect(() => {
    void refreshGitHubCopilotInstallState(getSettings(), true);
  }, []);

  const onSavePath = React.useCallback(async (path: string): Promise<string | null> => {
    const error = await validateGitHubCopilotCliPath(path, process.platform);
    if (error) return error;
    updateGitHubCopilotFields({ binaryPath: path });
    await refreshGitHubCopilotInstallState(getSettings(), true);
    new Notice("GitHub Copilot CLI path saved.");
    return null;
  }, []);

  const onClearPath = React.useCallback((): void => {
    updateGitHubCopilotFields({ binaryPath: undefined });
    new Notice("GitHub Copilot CLI path cleared. Copilot will find the installed CLI.");
  }, []);

  return (
    <GitHubCopilotConfigView
      state={state}
      binaryPath={resolveGitHubCopilotCliPath(settings) ?? override ?? ""}
      hasBinaryPathOverride={Boolean(override)}
      onSavePath={onSavePath}
      onClearPath={onClearPath}
      detect={() => Promise.resolve(detectGitHubCopilotCliPath())}
      searchedDirs={githubCopilotDetectionSearchDirs}
      installCommand={githubCopilotInstallCommand(process.platform)}
      signInCommand={githubCopilotSignInCommand(settings) ?? "copilot login"}
      platform={process.platform}
      onClose={onClose}
    />
  );
};

export class GitHubCopilotInstallModal extends FullBleedReactModal {
  constructor(app: App) {
    super(app);
  }

  protected renderContent(close: () => void): React.ReactElement {
    return <GitHubCopilotConfigContainer onClose={close} />;
  }
}
