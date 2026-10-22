import { PLUS_ENV } from "@/builtinSkills/builtinSkills";
import type { PersistedCopilotPlusCatalog, Provider } from "@/modelManagement";
import type { CopilotSettings } from "@/settings/model";
import {
  areVendorServicesBlocked,
  assertVendorServicesAllowed,
  isVendorProvider,
  isVendorUrl,
  namesVendorHost,
  stripVendorImages,
  VENDOR_SERVICES_BLOCKED_MESSAGE,
  VendorServicesBlockedError,
  vendorEnvKeys,
  vendorServicesTransition,
  visibleCopilotPlusCatalog,
  visibleProviders,
  withoutVendorEnv,
} from "@/vendorServices/vendorServicesPolicy";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/1";

const BLOCKED = { blockVendorServices: true } as const;
const ALLOWED = { blockVendorServices: false } as const;
const MISSING = {} as Pick<CopilotSettings, "blockVendorServices">;
const CORRUPT = { blockVendorServices: "no" } as unknown as Pick<
  CopilotSettings,
  "blockVendorServices"
>;

function provider(providerId: string, origin: Provider["origin"]): Provider {
  return {
    providerId,
    providerType: "openai-compatible",
    displayName: providerId,
    origin,
  } as Provider;
}

const PLUS_PROVIDER = provider("plus", { kind: "copilot-plus" });
const BYOK_PROVIDER = provider("byok", { kind: "byok" });

const CATALOG: PersistedCopilotPlusCatalog = {
  models: [{ id: "glm-5.2", displayName: "GLM-5.2" }],
  defaultEnabledIds: ["glm-5.2"],
};

describe("vendorServicesPolicy", () => {
  describe("areVendorServicesBlocked()", () => {
    it("blocks vendor services when the setting is on", () => {
      expect(areVendorServicesBlocked(BLOCKED)).toBe(true);
    });

    it("allows vendor services only when the setting is explicitly off", () => {
      expect(areVendorServicesBlocked(ALLOWED)).toBe(false);
    });

    it(`blocks vendor services when the setting is missing or not a boolean, so an old or corrupt data.json fails closed — ${ISSUE}`, () => {
      expect(areVendorServicesBlocked(MISSING)).toBe(true);
      expect(areVendorServicesBlocked(CORRUPT)).toBe(true);
    });
  });

  describe("assertVendorServicesAllowed()", () => {
    it("returns quietly while vendor services are allowed", () => {
      expect(() => assertVendorServicesAllowed(ALLOWED)).not.toThrow();
    });

    it("throws a VendorServicesBlockedError naming the setting while vendor services are blocked", () => {
      expect(() => assertVendorServicesAllowed(BLOCKED)).toThrow(VendorServicesBlockedError);
      expect(() => assertVendorServicesAllowed(BLOCKED)).toThrow(VENDOR_SERVICES_BLOCKED_MESSAGE);
    });
  });

  describe("VendorServicesBlockedError", () => {
    it("is an Error whose name identifies the vendor-services block", () => {
      const error = new VendorServicesBlockedError();

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("VendorServicesBlockedError");
      expect(error.message).toBe(VENDOR_SERVICES_BLOCKED_MESSAGE);
    });
  });

  describe("vendorServicesTransition()", () => {
    it("reports 'blocked' when the setting turns on", () => {
      expect(vendorServicesTransition(ALLOWED, BLOCKED)).toBe("blocked");
    });

    it("reports 'allowed' when the setting turns off", () => {
      expect(vendorServicesTransition(BLOCKED, ALLOWED)).toBe("allowed");
    });

    it("reports no transition when the effective policy is unchanged, including missing → on", () => {
      expect(vendorServicesTransition(BLOCKED, BLOCKED)).toBeNull();
      expect(vendorServicesTransition(ALLOWED, ALLOWED)).toBeNull();
      expect(vendorServicesTransition(MISSING, BLOCKED)).toBeNull();
    });
  });

  describe("namesVendorHost()", () => {
    it.each([
      "https://models.brevilabs.com/v1",
      '{"baseURL":"https://api.brevilabs.com/v1"}',
      "https://api.openartifacts.ai/v1/documents",
      "www.obsidiancopilot.com/pricing",
    ])("finds a vendor host in %s", (text) => {
      expect(namesVendorHost(text)).toBe(true);
    });

    it.each(['{"baseURL":"https://api.openai.com/v1"}', "notbrevilabs.com", "brevilabs.community"])(
      "finds no vendor host in %s",
      (text) => {
        expect(namesVendorHost(text)).toBe(false);
      }
    );
  });

  describe("isVendorUrl()", () => {
    it("recognizes vendor hosts and their subdomains", () => {
      expect(isVendorUrl("https://images.brevilabs.com/a.png")).toBe(true);
      expect(isVendorUrl("https://openartifacts.ai/")).toBe(true);
    });

    it("rejects other hosts, look-alike hosts, and unparsable text", () => {
      expect(isVendorUrl("https://github.com/user-attachments/assets/1")).toBe(false);
      expect(isVendorUrl("https://brevilabs.com.example.test/a.png")).toBe(false);
      expect(isVendorUrl("not a url")).toBe(false);
    });
  });

  describe("stripVendorImages()", () => {
    it("replaces a vendor-hosted Markdown image with its alt text", () => {
      expect(
        stripVendorImages("Before ![Diff tab](https://images.brevilabs.com/x/diff.png) after")
      ).toBe("Before Diff tab after");
    });

    it("turns a vendor-hosted demo-video thumbnail into a plain link to the video", () => {
      expect(
        stripVendorImages(
          "[![Demo video: Release](https://images.brevilabs.com/x/thumb.png)](https://youtube.com/shorts/abc)"
        )
      ).toBe("[Demo video: Release](https://youtube.com/shorts/abc)");
    });

    it("removes a vendor-hosted HTML image tag", () => {
      expect(
        stripVendorImages('A <img width="10" src="https://images.brevilabs.com/x.png" /> B')
      ).toBe("A  B");
    });

    it(`drops a reference definition that points at a vendor host, so a reference-style image cannot load — ${ISSUE}`, () => {
      const markdown =
        "![Shot][s]\n\n[s]: https://images.brevilabs.com/a.png\n[t]: https://github.com/a.png";

      expect(stripVendorImages(markdown)).toBe("![Shot][s]\n\n\n[t]: https://github.com/a.png");
    });

    it(`removes an HTML image or picture source whose srcset names a vendor host — ${ISSUE}`, () => {
      expect(
        stripVendorImages(
          '<img src="https://github.com/a.png" srcset="https://images.brevilabs.com/a@2x.png 2x" /><source srcset="https://images.brevilabs.com/b.png">'
        )
      ).toBe("");
    });

    it("keeps images hosted elsewhere unchanged", () => {
      const markdown =
        '![Screenshot](https://github.com/user-attachments/assets/1)\n<img src="https://github.com/a.png" />';

      expect(stripVendorImages(markdown)).toBe(markdown);
    });
  });

  describe("vendorEnvKeys()", () => {
    it("lists exactly the environment variables that carry the license and relay endpoint", () => {
      expect([...vendorEnvKeys()].sort()).toEqual(Object.values(PLUS_ENV).sort());
    });
  });

  describe("withoutVendorEnv()", () => {
    const env = {
      PATH: "/usr/bin",
      [PLUS_ENV.licenseKey]: "license",
      [PLUS_ENV.baseUrl]: "https://api.brevilabs.com/v1",
      [PLUS_ENV.userId]: "user",
      [PLUS_ENV.clientVersion]: "4.0.15",
    };

    it(`removes every vendor credential and endpoint variable while blocked — ${ISSUE}`, () => {
      expect(withoutVendorEnv(env, BLOCKED)).toEqual({ PATH: "/usr/bin" });
    });

    it(`removes every casing of a vendor variable, since Windows resolves names case-insensitively — ${ISSUE}`, () => {
      expect(
        withoutVendorEnv(
          { copilot_plus_license_key: "a", Copilot_Api_Base_Url: "b", Path: "/bin" },
          BLOCKED
        )
      ).toEqual({ Path: "/bin" });
    });

    it("does not mutate the environment it was given", () => {
      withoutVendorEnv(env, BLOCKED);

      expect(env[PLUS_ENV.licenseKey]).toBe("license");
    });

    it("returns the same environment while vendor services are allowed", () => {
      expect(withoutVendorEnv(env, ALLOWED)).toBe(env);
    });
  });

  describe("visibleCopilotPlusCatalog()", () => {
    it("returns the cached catalog while vendor services are allowed", () => {
      expect(visibleCopilotPlusCatalog({ ...ALLOWED, copilotPlusCatalog: CATALOG })).toBe(CATALOG);
    });

    it(`returns one frozen empty catalog while blocked, without touching the stored one — ${ISSUE}`, () => {
      const first = visibleCopilotPlusCatalog({ ...BLOCKED, copilotPlusCatalog: CATALOG });
      const second = visibleCopilotPlusCatalog({ ...BLOCKED, copilotPlusCatalog: CATALOG });

      expect(first.models).toEqual([]);
      expect(first.defaultEnabledIds).toEqual([]);
      expect(Object.isFrozen(first)).toBe(true);
      expect(second).toBe(first);
      expect(CATALOG.models).toHaveLength(1);
    });
  });

  describe("isVendorProvider()", () => {
    it("identifies the Copilot Plus provider origin as a vendor provider and an ordinary BYOK provider as not", () => {
      expect(isVendorProvider(PLUS_PROVIDER)).toBe(true);
      expect(isVendorProvider(BYOK_PROVIDER)).toBe(false);
    });

    it(`identifies a hand-added provider whose endpoint is a vendor host as a vendor provider — ${ISSUE}`, () => {
      expect(
        isVendorProvider({ ...BYOK_PROVIDER, baseUrl: "https://models.brevilabs.com/v1" })
      ).toBe(true);
      expect(isVendorProvider({ ...BYOK_PROVIDER, baseUrl: "https://api.openai.com/v1" })).toBe(
        false
      );
    });
  });

  describe("visibleProviders()", () => {
    const providers = { plus: PLUS_PROVIDER, byok: BYOK_PROVIDER };

    it("returns the stored providers unchanged while vendor services are allowed", () => {
      expect(visibleProviders({ ...ALLOWED, providers })).toBe(providers);
    });

    it(`hides Copilot Plus providers while blocked without removing them from settings — ${ISSUE}`, () => {
      const view = visibleProviders({ ...BLOCKED, providers });

      expect(view).toEqual({ byok: BYOK_PROVIDER });
      expect(providers.plus).toBe(PLUS_PROVIDER);
    });

    it("returns the same view object for the same stored providers so React selectors stay stable", () => {
      expect(visibleProviders({ ...BLOCKED, providers })).toBe(
        visibleProviders({ ...BLOCKED, providers })
      );
    });

    it("returns the stored providers when none of them is a vendor provider", () => {
      const byokOnly = { byok: BYOK_PROVIDER };

      expect(visibleProviders({ ...BLOCKED, providers: byokOnly })).toBe(byokOnly);
    });
  });
});
