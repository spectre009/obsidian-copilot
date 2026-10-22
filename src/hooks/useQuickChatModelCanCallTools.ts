import { useAtomValue } from "jotai";
import { useMemo } from "react";

import { useModelKey } from "@/aiParams";
import {
  chatBackendPickerAtom,
  findChatBackendEntry,
  mapProviderTypeToChatModelProvider,
} from "@/modelManagement";
import { settingsStore } from "@/settings/model";
import { configuredModelCanCallTools } from "@/vendorServices/localVaultChat";

/**
 * Whether the model Quick Chat will run can call tools, resolved the way the chat resolves its
 * model (falling back to the first enabled one), so the chat input and the runner agree on whether
 * a turn is autonomous. https://github.com/spectre009/obsidian-copilot/issues/3
 */
export function useQuickChatModelCanCallTools(): boolean {
  const [modelKey] = useModelKey();
  const entries = useAtomValue(chatBackendPickerAtom, { store: settingsStore });
  return useMemo(() => {
    const entry = findChatBackendEntry(entries, modelKey || undefined);
    return configuredModelCanCallTools(
      entry ? { provider: mapProviderTypeToChatModelProvider(entry.provider) } : null
    );
  }, [entries, modelKey]);
}
