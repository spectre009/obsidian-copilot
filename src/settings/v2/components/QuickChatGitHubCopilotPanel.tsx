import { useModelKey } from "@/aiParams";
import { ChatModelProviders } from "@/constants";
import { useChatBackendModelOptions } from "@/hooks/useChatBackendModelOptions";
import {
  useGitHubCopilotAccount,
  useGitHubCopilotModel,
} from "@/hooks/useGitHubCopilotQuickChatStatus";
import {
  promptBudgetTokens,
  supportsLongContext,
} from "@/LLMProviders/githubCopilot/githubCopilotModels";
import {
  chatBackendPickerAtom,
  findChatBackendEntry,
  mapProviderTypeToChatModelProvider,
} from "@/modelManagement";
import type { GitHubCopilotQuickChatSettings as CopilotQuickChatSettings } from "@/settings/githubCopilotQuickChatSettings";
import { settingsStore, setSettings, updateSetting, useSettingsValue } from "@/settings/model";
import {
  BackgroundModelSetting,
  SAME_AS_CHAT_MODEL,
} from "@/settings/v2/components/ui/BackgroundModelSetting";
import { GitHubCopilotQuickChatSettings } from "@/settings/v2/components/ui/GitHubCopilotQuickChatSettings";
import { useAtomValue } from "jotai";
import React from "react";

function updateCopilotQuickChat(patch: Partial<CopilotQuickChatSettings>): void {
  setSettings((current) => ({
    githubCopilotQuickChat: { ...current.githubCopilotQuickChat, ...patch },
  }));
}

function useSelectedGitHubCopilotModel(
  modelKey: string
): { id: string; label: string } | undefined {
  const entries = useAtomValue(chatBackendPickerAtom, { store: settingsStore });
  return React.useMemo(() => {
    const entry = findChatBackendEntry(entries, modelKey || undefined);
    if (!entry) return undefined;
    if (mapProviderTypeToChatModelProvider(entry.provider) !== ChatModelProviders.GITHUB_COPILOT) {
      return undefined;
    }
    const info = entry.configuredModel.info;
    return { id: info.id, label: info.displayName || info.id };
  }, [entries, modelKey]);
}

/**
 * Quick Chat's background model and GitHub Copilot controls, bound to settings and to the running
 * GitHub Copilot CLI. https://github.com/spectre009/obsidian-copilot/issues/3
 */
export const QuickChatGitHubCopilotPanel: React.FC = () => {
  const settings = useSettingsValue();
  const { options, resolveSelectionId } = useChatBackendModelOptions(false);
  const account = useGitHubCopilotAccount();
  const [modelKey] = useModelKey();
  const selectedCopilotModel = useSelectedGitHubCopilotModel(modelKey);
  const copilotModel = useGitHubCopilotModel(selectedCopilotModel?.id);
  const quickChat = settings.githubCopilotQuickChat;

  const modelWindow = selectedCopilotModel
    ? {
        modelLabel: selectedCopilotModel.label,
        defaultTokens: promptBudgetTokens("default", copilotModel),
        longContextTokens: supportsLongContext(copilotModel)
          ? promptBudgetTokens("long_context", copilotModel)
          : undefined,
      }
    : undefined;

  return (
    <>
      <BackgroundModelSetting
        value={
          (settings.backgroundModelKey && resolveSelectionId(settings.backgroundModelKey)) ||
          SAME_AS_CHAT_MODEL
        }
        options={options}
        onChange={(value) =>
          updateSetting("backgroundModelKey", value === SAME_AS_CHAT_MODEL ? "" : value)
        }
        thinkingLevel={quickChat.backgroundThinkingLevel}
        onThinkingLevelChange={(level) =>
          updateCopilotQuickChat({ backgroundThinkingLevel: level })
        }
      />
      <GitHubCopilotQuickChatSettings
        account={account}
        thinkingLevel={quickChat.thinkingLevel}
        onThinkingLevelChange={(level) => updateCopilotQuickChat({ thinkingLevel: level })}
        contextWindow={quickChat.contextWindow}
        onContextWindowChange={(window) => updateCopilotQuickChat({ contextWindow: window })}
        modelWindow={modelWindow}
      />
    </>
  );
};
