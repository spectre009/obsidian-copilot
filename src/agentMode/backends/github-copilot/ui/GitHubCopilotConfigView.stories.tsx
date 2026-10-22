import { FULL_BLEED_MODAL_CLASS } from "@/components/modals/ReactModal";
import {
  GitHubCopilotConfigView,
  type GitHubCopilotConfigViewProps,
} from "@/agentMode/backends/github-copilot/ui/GitHubCopilotConfigView";
import type { InstallState } from "@/agentMode/session/types";
import type { Meta, StoryObj } from "@/lib/story";

const WINGET_PATH =
  "C:\\Users\\zero\\AppData\\Local\\Microsoft\\WinGet\\Packages\\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\\copilot.exe";

const OUTDATED: InstallState = {
  kind: "incompatible",
  source: "managed",
  currentVersion: "1.0.90",
  minVersion: "1.0.102",
  message:
    "GitHub Copilot CLI v1.0.90 is not supported. Copilot requires GitHub Copilot CLI v1.0.102 or newer.",
};

const meta = {
  title: "Agent Mode/GitHub Copilot Config View",
  component: GitHubCopilotConfigView,
  args: {
    state: { kind: "absent" },
    binaryPath: "",
    hasBinaryPathOverride: false,
    onSavePath: () => Promise.resolve(null),
    onClearPath: () => undefined,
    detect: () => Promise.resolve(null),
    searchedDirs: () => [],
    installCommand: "winget install GitHub.Copilot",
    signInCommand: "copilot login",
    platform: "win32",
    onClose: () => undefined,
  },
  parameters: {
    gallery: { host: "modal", layout: "fullscreen", modalClass: FULL_BLEED_MODAL_CLASS },
  },
} satisfies Meta<GitHubCopilotConfigViewProps>;
export default meta;

export const NotInstalled: StoryObj<GitHubCopilotConfigViewProps> = {};

export const Checking: StoryObj<GitHubCopilotConfigViewProps> = {
  args: {
    state: { kind: "checking", source: "managed" },
    binaryPath: WINGET_PATH,
    signInCommand: `& '${WINGET_PATH}' login`,
  },
};

export const Ready: StoryObj<GitHubCopilotConfigViewProps> = {
  args: {
    state: { kind: "ready", source: "managed" },
    binaryPath: WINGET_PATH,
    signInCommand: `& '${WINGET_PATH}' login`,
  },
};

export const CustomPath: StoryObj<GitHubCopilotConfigViewProps> = {
  args: {
    state: { kind: "ready", source: "custom" },
    binaryPath: "D:\\tools\\copilot\\copilot.exe",
    hasBinaryPathOverride: true,
    signInCommand: "D:\\tools\\copilot\\copilot.exe login",
  },
};

export const UpdateRequired: StoryObj<GitHubCopilotConfigViewProps> = {
  args: {
    state: OUTDATED,
    binaryPath: WINGET_PATH,
    signInCommand: `& '${WINGET_PATH}' login`,
  },
};

export const MacOS: StoryObj<GitHubCopilotConfigViewProps> = {
  args: {
    state: { kind: "ready", source: "managed" },
    binaryPath: "/opt/homebrew/bin/copilot",
    installCommand: "brew install --cask copilot-cli",
    signInCommand: "/opt/homebrew/bin/copilot login",
    platform: "darwin",
  },
};
