import { GitHubCopilotEnvSettings } from "@/agentMode/backends/github-copilot/ui/GitHubCopilotEnvSettings";
import type { Meta, StoryObj } from "@/lib/story";
import type React from "react";

type Props = React.ComponentProps<typeof GitHubCopilotEnvSettings>;

const meta = {
  title: "Agent Mode/GitHub Copilot Environment Settings",
  component: GitHubCopilotEnvSettings,
  args: {
    value: undefined,
    onChange: () => undefined,
  },
} satisfies Meta<Props>;
export default meta;

export const Empty: StoryObj<Props> = {};

export const WithProxyAndHost: StoryObj<Props> = {
  args: {
    value: { HTTPS_PROXY: "http://proxy.example:8080", COPILOT_GH_HOST: "example.ghe.com" },
  },
};
