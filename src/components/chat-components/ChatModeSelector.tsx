import { ChainType } from "@/chainType";
import { Button } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DropdownMenu, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Database, Sparkles, SquareArrowOutUpRight } from "lucide-react";
import React from "react";

interface ChatModeSelectorProps {
  selectedChain: ChainType;
  isPaidUser: boolean;
  /**
   * While vendor services are blocked, the note-finding mode runs locally as "vault chat", with no
   * license and no upsell. https://github.com/spectre009/obsidian-copilot/issues/3
   */
  vaultChat?: boolean;
  onModeChange: (chainType: ChainType) => void;
  onPlusUpsell: () => void;
  defaultOpen?: boolean;
}

function PlusModeLabel({ vaultChat }: { vaultChat: boolean }) {
  return (
    <div className="tw-flex tw-items-center tw-gap-1">
      {vaultChat ? <Database className="tw-size-4" /> : <Sparkles className="tw-size-4" />}
      {vaultChat ? "vault chat" : "copilot plus"}
    </div>
  );
}

export function ChatModeSelector({
  selectedChain,
  isPaidUser,
  vaultChat = false,
  onModeChange,
  onPlusUpsell,
  defaultOpen,
}: ChatModeSelectorProps) {
  const chatLabel = vaultChat ? "chat" : "chat (free)";
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost2" size="fit" className="tw-ml-1 tw-text-sm tw-text-muted">
          {selectedChain === ChainType.LLM_CHAIN ? (
            chatLabel
          ) : (
            <PlusModeLabel vaultChat={vaultChat} />
          )}
          <ChevronDown className="tw-mt-0.5 tw-size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onModeChange(ChainType.LLM_CHAIN)}>
          {chatLabel}
        </DropdownMenuItem>
        {vaultChat || isPaidUser ? (
          <DropdownMenuItem onSelect={() => onModeChange(ChainType.COPILOT_PLUS_CHAIN)}>
            <PlusModeLabel vaultChat={vaultChat} />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onPlusUpsell}>
            copilot plus
            <SquareArrowOutUpRight className="tw-size-3" />
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
