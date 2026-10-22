import type { ChainType } from "@/chainType";
import type { Meta, StoryObj } from "@/lib/story";
import React from "react";
import { ChatToolControls } from "./ChatToolControls";

type Props = React.ComponentProps<typeof ChatToolControls>;

const BASE_ARGS: Props = {
  vaultToggle: true,
  setVaultToggle: () => undefined,
  webToggle: false,
  setWebToggle: () => undefined,
  composerToggle: false,
  setComposerToggle: () => undefined,
  autonomousAgentToggle: false,
  setAutonomousAgentToggle: () => undefined,
  currentChain: "copilot_plus" as ChainType,
};

// The inline buttons appear only inside the chat input's container at 420px or wider.
// https://github.com/spectre009/obsidian-copilot/issues/3 https://github.com/spectre009/obsidian-copilot/issues/3
function InChatInput(props: Partial<Props>) {
  return (
    <div className="tw-w-[480px] tw-rounded-md tw-border tw-border-solid tw-border-border tw-p-2 tw-@container/chat-input">
      <ChatToolControls {...BASE_ARGS} {...props} />
    </div>
  );
}

const meta = {
  title: "Chat/Quick Chat Tool Controls",
  component: ChatToolControls,
  args: BASE_ARGS,
  parameters: { gallery: { host: "leaf", layout: "padded" } },
} satisfies Meta<Props>;
export default meta;

export const CopilotPlus: StoryObj<Props> = { render: InChatInput };

export const VaultChatOnGitHubCopilot: StoryObj<Props> = {
  args: { showAutonomousAgent: false, showWebSearch: false },
  render: InChatInput,
};

export const VaultChatWithToolCallingModel: StoryObj<Props> = {
  args: { showWebSearch: false },
  render: InChatInput,
};

export const NarrowVaultChatMenu: StoryObj<Props> = {
  args: { showAutonomousAgent: false, showWebSearch: false },
};
