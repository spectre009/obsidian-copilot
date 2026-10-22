import { useChainType } from "@/aiParams";
import { useQuickChatModelCanCallTools } from "@/hooks/useQuickChatModelCanCallTools";
import { useSettingsValue } from "@/settings/model";
import { isPlusChain } from "@/utils";
import { isEffectivelyAutonomous } from "@/vendorServices/localVaultChat";
import { areVendorServicesBlocked } from "@/vendorServices/vendorServicesPolicy";
import { Notice } from "obsidian";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatInput, { type ChatInputHandle, type ChatInputProps } from "./ChatInput";
import { ChatToolControls } from "./ChatToolControls";

type ChatModeInputProps = Omit<
  ChatInputProps,
  "toolControls" | "onToolPillsChange" | "onTagSelected"
>;

const ChatModeInput: React.FC<ChatModeInputProps> = (props) => {
  const { handleSendMessage, inputMessage } = props;
  const [currentChain] = useChainType();
  const settings = useSettingsValue();
  const isCopilotPlus = isPlusChain(currentChain);
  const canCallTools = useQuickChatModelCanCallTools();
  const vendorServicesBlocked = areVendorServicesBlocked(settings);

  const [vaultToggle, setVaultToggle] = useState(false);
  const [webToggle, setWebToggle] = useState(false);
  const [composerToggle, setComposerToggle] = useState(false);
  const [autonomousAgentToggle, setAutonomousAgentToggle] = useState(
    settings.enableAutonomousAgent
  );
  // Models that can't call tools never run the agent, so the input behaves as non-autonomous for
  // them and adds `@vault` itself. https://github.com/spectre009/obsidian-copilot/issues/3
  const effectiveAutonomous = isEffectivelyAutonomous(
    { enableAutonomousAgent: autonomousAgentToggle },
    canCallTools
  );
  const isVaultChat = isCopilotPlus && vendorServicesBlocked && !effectiveAutonomous;

  useEffect(() => {
    /* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- mirror the persisted setting into the local toggle; the toggle is also user-editable so it can't be pure derived state */
    setAutonomousAgentToggle(settings.enableAutonomousAgent);
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- resume checking after the persisted-state synchronization */
  }, [settings.enableAutonomousAgent]);

  // Vault chat exists to find notes, so entering it searches the vault by default; the user can
  // still turn the toggle off for a turn. https://github.com/spectre009/obsidian-copilot/issues/3
  useEffect(() => {
    /* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- entering vault chat sets the user-editable toggle's starting value */
    if (isVaultChat) setVaultToggle(true);
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- resume checking after the mode-entry default */
  }, [isVaultChat]);

  const chatInputRef = useRef<ChatInputHandle>(null);

  const handleVaultToggleOff = useCallback(() => {
    chatInputRef.current?.removeToolPills(["@vault"]);
  }, []);

  const handleWebToggleOff = useCallback(() => {
    chatInputRef.current?.removeToolPills(["@websearch", "@web"]);
  }, []);

  const handleComposerToggleOff = useCallback(() => {
    chatInputRef.current?.removeToolPills(["@composer"]);
  }, []);

  const handleToolPillsChange = useCallback(
    (toolNames: string[]) => {
      if (effectiveAutonomous) return;
      setVaultToggle(toolNames.includes("@vault"));
      setWebToggle(
        !vendorServicesBlocked && (toolNames.includes("@websearch") || toolNames.includes("@web"))
      );
      setComposerToggle(toolNames.includes("@composer"));
    },
    [effectiveAutonomous, vendorServicesBlocked]
  );

  const handleTagSelected = useCallback(() => {
    if (isCopilotPlus && !effectiveAutonomous && !vaultToggle) {
      setVaultToggle(true);
      new Notice("Vault search enabled for tag query");
    }
  }, [isCopilotPlus, effectiveAutonomous, vaultToggle]);

  const wrappedHandleSendMessage: ChatInputProps["handleSendMessage"] = useCallback(
    (metadata: Parameters<ChatInputProps["handleSendMessage"]>[0]) => {
      if (!isCopilotPlus || effectiveAutonomous) {
        handleSendMessage(metadata);
        return;
      }
      const messageLower = inputMessage.toLowerCase();
      const toolCalls: string[] = [];
      if (vaultToggle && !messageLower.includes("@vault")) {
        toolCalls.push("@vault");
      }
      if (
        webToggle &&
        !vendorServicesBlocked &&
        !messageLower.includes("@websearch") &&
        !messageLower.includes("@web")
      ) {
        toolCalls.push("@websearch");
      }
      if (composerToggle && !messageLower.includes("@composer")) {
        toolCalls.push("@composer");
      }
      if (toolCalls.length === 0) {
        handleSendMessage(metadata);
        return;
      }
      handleSendMessage({ ...metadata, toolCalls });
    },
    [
      handleSendMessage,
      inputMessage,
      isCopilotPlus,
      effectiveAutonomous,
      vendorServicesBlocked,
      vaultToggle,
      webToggle,
      composerToggle,
    ]
  );

  const toolControls = useMemo(
    () => (
      <ChatToolControls
        vaultToggle={vaultToggle}
        setVaultToggle={setVaultToggle}
        webToggle={webToggle}
        setWebToggle={setWebToggle}
        composerToggle={composerToggle}
        setComposerToggle={setComposerToggle}
        autonomousAgentToggle={effectiveAutonomous}
        setAutonomousAgentToggle={setAutonomousAgentToggle}
        showAutonomousAgent={canCallTools}
        showWebSearch={!vendorServicesBlocked}
        currentChain={currentChain}
        onVaultToggleOff={handleVaultToggleOff}
        onWebToggleOff={handleWebToggleOff}
        onComposerToggleOff={handleComposerToggleOff}
      />
    ),
    [
      vaultToggle,
      webToggle,
      composerToggle,
      effectiveAutonomous,
      canCallTools,
      vendorServicesBlocked,
      currentChain,
      handleVaultToggleOff,
      handleWebToggleOff,
      handleComposerToggleOff,
    ]
  );

  return (
    <ChatInput
      {...props}
      ref={chatInputRef}
      handleSendMessage={wrappedHandleSendMessage}
      toolControls={toolControls}
      onToolPillsChange={handleToolPillsChange}
      onTagSelected={handleTagSelected}
    />
  );
};

export default ChatModeInput;
