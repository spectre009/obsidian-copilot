import { GitHubCopilotContextWindowSetting } from "@/agentMode/backends/github-copilot/ui/GitHubCopilotContextWindowSetting";
import type { Meta, StoryObj } from "@/lib/story";
import type React from "react";

type Props = React.ComponentProps<typeof GitHubCopilotContextWindowSetting>;

const meta = {
  title: "Agent Mode/GitHub Copilot Context Window",
  component: GitHubCopilotContextWindowSetting,
  args: {
    value: undefined,
    onChange: () => undefined,
  },
} satisfies Meta<Props>;
export default meta;

export const Default: StoryObj<Props> = {};

export const LongContext: StoryObj<Props> = {
  args: { value: "long_context" },
};
