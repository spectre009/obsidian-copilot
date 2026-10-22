import { BinaryPathSetting } from "@/agentMode/backends/shared/BinaryPathSetting";
import {
  ConfigDialogShell,
  ConfigSection,
  ConfigWarningStrip,
} from "@/agentMode/backends/shared/ui/ConfigDialogShell";
import { CommandBlock } from "@/agentMode/backends/shared/ui/SetupSteps";
import type { InstallState } from "@/agentMode/session/types";
import React from "react";

export interface GitHubCopilotConfigViewProps {
  state: InstallState;
  binaryPath: string;
  hasBinaryPathOverride: boolean;
  onSavePath: (path: string) => Promise<string | null>;
  onClearPath: () => void;
  detect: () => Promise<string | null>;
  searchedDirs: () => string[];
  installCommand: string;
  signInCommand: string;
  platform: NodeJS.Platform;
  onClose: () => void;
}

export const GitHubCopilotConfigView: React.FC<GitHubCopilotConfigViewProps> = ({
  state,
  binaryPath,
  hasBinaryPathOverride,
  onSavePath,
  onClearPath,
  detect,
  searchedDirs,
  installCommand,
  signInCommand,
  platform,
  onClose,
}) => (
  <ConfigDialogShell
    title="Configure GitHub Copilot"
    state={state}
    warning={<ConfigWarningStrip state={state} />}
    onClose={onClose}
  >
    <ConfigSection title="GitHub Copilot CLI">
      <p className="tw-my-0 tw-text-sm tw-text-muted">
        Copilot runs the <code>copilot</code> CLI installed on this machine. Auto-detect checks your
        PATH{platform === "win32" ? " and the WinGet install folder" : ""}.
      </p>
      <BinaryPathSetting
        binaryName="copilot"
        placeholder={
          platform === "win32" ? "C:\\path\\to\\copilot.exe" : "/absolute/path/to/copilot"
        }
        initialPath={binaryPath}
        hasPersistedPath={hasBinaryPathOverride}
        notFoundHint="GitHub Copilot CLI was not found. Run the install command below, then click Auto-detect again."
        onSave={onSavePath}
        onClear={onClearPath}
        persistOnAutoDetect
        detect={detect}
        searchedDirs={searchedDirs}
      />
    </ConfigSection>

    <ConfigSection title="Install GitHub Copilot CLI">
      <CommandBlock command={installCommand} />
    </ConfigSection>

    <ConfigSection title="Sign in">
      <p className="tw-my-0 tw-text-sm tw-text-muted">
        Copilot uses the GitHub account you signed in to the CLI with, and bills chats to its
        Copilot plan. To sign in or switch accounts, run this in a terminal, then start a new chat.
      </p>
      <CommandBlock command={signInCommand} />
    </ConfigSection>
  </ConfigDialogShell>
);
