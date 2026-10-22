import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { logWarn } from "@/logger";
import {
  configuredModelToCustomModel,
  findChatBackendEntry,
  type ModelManagementApi,
} from "@/modelManagement";
import { getSettings, type CopilotSettings } from "@/settings/model";
import type ChatModelManager from "./chatModelManager";

export interface BackgroundChatModelDeps {
  modelManagement: Pick<ModelManagementApi, "backendConfigRegistry" | "providerRegistry">;
  chatModelManager: Pick<ChatModelManager, "getChatModel" | "createModelInstanceFromBridged">;
  settings?: Pick<CopilotSettings, "backgroundModelKey" | "githubCopilotQuickChat">;
}

/**
 * The model for Quick Chat's background calls: query expansion, chat titles and conversation
 * summaries. They run on every searching turn and every new chat, so a cheaper model than the chat
 * model saves most of their cost. Falls back to the chat model when the setting is "Same as chat
 * model" or names a model that isn't enabled in Quick Chat.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param deps model management, the chat model factory, and optionally the settings to read
 */
export async function getBackgroundChatModel(
  deps: BackgroundChatModelDeps
): Promise<BaseChatModel> {
  const settings = deps.settings ?? getSettings();
  const key = settings.backgroundModelKey;
  if (key) {
    try {
      const entry = findChatBackendEntry(
        deps.modelManagement.backendConfigRegistry.resolveEnabled("chat"),
        key,
        false
      );
      if (entry) {
        const apiKey = await deps.modelManagement.providerRegistry.getApiKey(
          entry.provider.providerId
        );
        const customModel = configuredModelToCustomModel({
          provider: entry.provider,
          configuredModel: entry.configuredModel,
          apiKey,
        });
        return await deps.chatModelManager.createModelInstanceFromBridged(customModel, {
          githubCopilotThinkingLevel: settings.githubCopilotQuickChat.backgroundThinkingLevel,
        });
      }
    } catch (error) {
      logWarn("[BackgroundModel] Falling back to the chat model", error);
    }
  }
  return deps.chatModelManager.getChatModel();
}
