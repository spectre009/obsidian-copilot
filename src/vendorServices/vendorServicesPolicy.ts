import { PLUS_ENV } from "@/builtinSkills/builtinSkills";
import type { PersistedCopilotPlusCatalog, Provider } from "@/modelManagement";
import type { CopilotSettings } from "@/settings/model";

export const VENDOR_SERVICES_BLOCKED_MESSAGE =
  "Copilot's vendor services are turned off by Block vendor services in Settings → Basic.";

export class VendorServicesBlockedError extends Error {
  constructor() {
    super(VENDOR_SERVICES_BLOCKED_MESSAGE);
    this.name = "VendorServicesBlockedError";
    Object.setPrototypeOf(this, VendorServicesBlockedError.prototype);
  }
}

type PolicySettings = Pick<CopilotSettings, "blockVendorServices">;

// Persisted settings load without a defaults merge, so only an explicit `false` allows vendor
// traffic. https://github.com/spectre009/obsidian-copilot/issues/1
export function areVendorServicesBlocked(settings: PolicySettings): boolean {
  return settings.blockVendorServices !== false;
}

export function assertVendorServicesAllowed(settings: PolicySettings): void {
  if (areVendorServicesBlocked(settings)) throw new VendorServicesBlockedError();
}

export type VendorServicesTransition = "blocked" | "allowed" | null;

export function vendorServicesTransition(
  prev: PolicySettings,
  next: PolicySettings
): VendorServicesTransition {
  const wasBlocked = areVendorServicesBlocked(prev);
  const isBlocked = areVendorServicesBlocked(next);
  if (wasBlocked === isBlocked) return null;
  return isBlocked ? "blocked" : "allowed";
}

const VENDOR_DOMAINS = ["brevilabs.com", "openartifacts.ai", "obsidiancopilot.com"] as const;

const VENDOR_HOST_PATTERN =
  /\b(?:[a-z0-9-]+\.)*(?:brevilabs\.com|openartifacts\.ai|obsidiancopilot\.com)\b/i;

export function namesVendorHost(text: string): boolean {
  return VENDOR_HOST_PATTERN.test(text);
}

export function isVendorUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return VENDOR_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const LINK_REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:[ \t]*<?(\S+?)>?(?:[ \t].*)?$/gm;
const HTML_IMAGE = /<(?:img|source)\b[^>]*>/gi;

export function stripVendorImages(markdown: string): string {
  return markdown
    .replace(MARKDOWN_IMAGE, (image: string, alt: string, url: string) =>
      isVendorUrl(url) ? alt : image
    )
    .replace(LINK_REFERENCE_DEFINITION, (definition: string, url: string) =>
      isVendorUrl(url) ? "" : definition
    )
    .replace(HTML_IMAGE, (tag) => (namesVendorHost(tag) ? "" : tag));
}

export function vendorEnvKeys(): readonly string[] {
  return Object.values(PLUS_ENV);
}

export function withoutVendorEnv<T extends Record<string, string | undefined>>(
  env: T,
  settings: PolicySettings
): T {
  if (!areVendorServicesBlocked(settings)) return env;
  // Windows resolves environment names case-insensitively, so every casing of a key is removed.
  // https://github.com/spectre009/obsidian-copilot/issues/1
  const vendorKeys = new Set(vendorEnvKeys().map((key) => key.toUpperCase()));
  const scrubbed: Record<string, string | undefined> = { ...env };
  for (const key of Object.keys(scrubbed)) {
    if (vendorKeys.has(key.toUpperCase())) delete scrubbed[key];
  }
  return scrubbed as T;
}

const EMPTY_COPILOT_PLUS_CATALOG = Object.freeze({
  models: Object.freeze([]),
  defaultEnabledIds: Object.freeze([]),
}) as unknown as PersistedCopilotPlusCatalog;

export function visibleCopilotPlusCatalog(
  settings: Pick<CopilotSettings, "blockVendorServices" | "copilotPlusCatalog">
): PersistedCopilotPlusCatalog {
  return areVendorServicesBlocked(settings)
    ? EMPTY_COPILOT_PLUS_CATALOG
    : settings.copilotPlusCatalog;
}

// A provider added by hand can still point at a vendor endpoint, so the host counts as well as the
// origin. https://github.com/spectre009/obsidian-copilot/issues/1
export function isVendorProvider(provider: Provider): boolean {
  return (
    provider.origin.kind === "copilot-plus" ||
    (typeof provider.baseUrl === "string" && isVendorUrl(provider.baseUrl))
  );
}

const blockedProviderViews = new WeakMap<
  Readonly<Record<string, Provider>>,
  Readonly<Record<string, Provider>>
>();

export function visibleProviders(
  settings: Pick<CopilotSettings, "blockVendorServices" | "providers">
): Readonly<Record<string, Provider>> {
  const { providers } = settings;
  if (!areVendorServicesBlocked(settings)) return providers;
  const cached = blockedProviderViews.get(providers);
  if (cached) return cached;
  const kept = Object.entries(providers).filter(([, provider]) => !isVendorProvider(provider));
  const view =
    kept.length === Object.keys(providers).length
      ? providers
      : Object.freeze(Object.fromEntries(kept));
  blockedProviderViews.set(providers, view);
  return view;
}
