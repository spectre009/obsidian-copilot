import type { App } from "obsidian";
import { ChatModelProviders } from "@/constants";
import type { LicenseCheckContext } from "@/LLMProviders/brevilabsClient";
import { checkIsPaidUser } from "@/plusUtils";
import { getSettings, type CopilotSettings } from "@/settings/model";
import { areVendorServicesBlocked } from "./vendorServicesPolicy";

// The Plus tools that call vendor services; local retrieval, note reading and editing stay.
// https://github.com/spectre009/obsidian-copilot/issues/3
const VENDOR_TOOL_NAMES: ReadonlySet<string> = new Set(["webSearch", "youtubeTranscription"]);

/**
 * Whether Quick Chat's note-finding mode may run. With vendor services blocked it is "vault chat":
 * local retrieval and source links, which need no license. Otherwise the license decides, as
 * before. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param app the Obsidian app, for the license check
 * @param context why the license is checked, passed through to the license check
 */
export async function canRunVaultChat(
  app: App | undefined,
  context: LicenseCheckContext
): Promise<boolean> {
  if (areVendorServicesBlocked(getSettings())) return true;
  return Boolean(await checkIsPaidUser(app, context));
}

/**
 * Drops the tools that call vendor services while they are blocked.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param tools the tools the agent would otherwise get
 * @param settings the current settings
 */
export function withoutVendorTools<T extends { name: string }>(
  tools: readonly T[],
  settings: Pick<CopilotSettings, "blockVendorServices"> = getSettings()
): T[] {
  if (!areVendorServicesBlocked(settings)) return [...tools];
  return tools.filter((tool) => !VENDOR_TOOL_NAMES.has(tool.name));
}

/** Whether a chat model instance can call tools natively. https://github.com/spectre009/obsidian-copilot/issues/3 */
export function modelCanCallTools(model: unknown): boolean {
  return typeof (model as { bindTools?: unknown } | null)?.bindTools === "function";
}

/**
 * Whether a configured chat model can call tools natively. GitHub Copilot models can't: the SDK
 * gives no tool calls back to the caller. https://github.com/spectre009/obsidian-copilot/issues/3
 * @param model the selected Quick Chat model
 */
export function configuredModelCanCallTools(
  model: { provider?: string } | null | undefined
): boolean {
  return model?.provider !== ChatModelProviders.GITHUB_COPILOT;
}

/**
 * Whether a turn runs the autonomous agent: the setting is on and the model can call tools.
 * Otherwise the turn uses automatic retrieval, so models without tool calling still find notes.
 * The chat input mirrors this rather than the raw setting so it adds `@vault` for those models.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 * @param settings the current settings
 * @param canCallTools whether the chat model can call tools
 */
export function isEffectivelyAutonomous(
  settings: Pick<CopilotSettings, "enableAutonomousAgent">,
  canCallTools: boolean
): boolean {
  return settings.enableAutonomousAgent && canCallTools;
}
