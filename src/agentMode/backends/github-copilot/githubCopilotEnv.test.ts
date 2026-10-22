import { PLUS_ENV } from "@/builtinSkills/builtinSkills";
import { buildGitHubCopilotEnv, isPluginOwnedGitHubCopilotEnvKey } from "./githubCopilotEnv";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";
const BLOCKED = { blockVendorServices: true };
const ALLOWED = { blockVendorServices: false };

describe("githubCopilotEnv", () => {
  describe("isPluginOwnedGitHubCopilotEnvKey()", () => {
    it.each([
      "COPILOT_HOME",
      "copilot_allow_all",
      "COPILOT_MODEL",
      "COPILOT_PROVIDER_BASE_URL",
      "COPILOT_CUSTOM_INSTRUCTIONS_DIRS",
      "COPILOT_CLI_ENABLED_FEATURE_FLAGS",
      "COPILOT_DEBUG_GITHUB_API_URL",
      "COPILOT_GITHUB_TOKEN",
      "gh_token",
      "GITHUB_TOKEN",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
    ])(`owns %s, which could reroute, authorize or export the agent ${ISSUE}`, (key) => {
      expect(isPluginOwnedGitHubCopilotEnvKey(key)).toBe(true);
    });

    it.each([
      "COPILOT_GH_HOST",
      "COPILOT_PROXY_KERBEROS_SPN",
      "GH_HOST",
      "HTTPS_PROXY",
      "NODE_EXTRA_CA_CERTS",
      "HOME",
      "USERPROFILE",
    ])("leaves %s to the user, because reaching GitHub can depend on it", (key) => {
      expect(isPluginOwnedGitHubCopilotEnvKey(key)).toBe(false);
    });
  });

  describe("buildGitHubCopilotEnv()", () => {
    it(`drops inherited Copilot controls, tokens and telemetry in any casing ${ISSUE}`, () => {
      const env = buildGitHubCopilotEnv({
        inherited: {
          copilot_allow_all: "true",
          COPILOT_PROVIDER_BASE_URL: "https://byok.example",
          Gh_Token: "secret",
          GITHUB_TOKEN: "secret",
          OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example",
          COPILOT_GH_HOST: "example.ghe.com",
          HTTPS_PROXY: "http://proxy:8080",
          USERPROFILE: "C:\\Users\\me",
        },
        home: "/h",
        settings: ALLOWED,
      });

      expect(env).toEqual({
        COPILOT_GH_HOST: "example.ghe.com",
        HTTPS_PROXY: "http://proxy:8080",
        USERPROFILE: "C:\\Users\\me",
        COPILOT_HOME: "/h",
        COPILOT_AUTO_UPDATE: "false",
      });
    });

    it(`ignores user overrides of plugin-owned keys and applies the rest ${ISSUE}`, () => {
      const env = buildGitHubCopilotEnv({
        inherited: {},
        overrides: {
          COPILOT_ALLOW_ALL: "true",
          COPILOT_HOME: "/elsewhere",
          GH_TOKEN: "secret",
          HTTPS_PROXY: "http://proxy:8080",
        },
        home: "/h",
        settings: ALLOWED,
      });

      expect(env).toEqual({
        HTTPS_PROXY: "http://proxy:8080",
        COPILOT_HOME: "/h",
        COPILOT_AUTO_UPDATE: "false",
      });
    });

    it("lets an override replace an inherited value whatever its casing", () => {
      const env = buildGitHubCopilotEnv({
        inherited: { https_proxy: "http://old:1" },
        overrides: { HTTPS_PROXY: "http://new:2" },
        home: "/h",
        settings: ALLOWED,
      });

      expect(env.HTTPS_PROXY).toBe("http://new:2");
      expect(env.https_proxy).toBeUndefined();
    });

    it("replaces PATH under the casing Windows inherited", () => {
      const env = buildGitHubCopilotEnv({
        inherited: { Path: "C:\\Windows" },
        home: "/h",
        path: "C:\\Tools;C:\\Windows",
        settings: ALLOWED,
      });

      expect(env.PATH).toBe("C:\\Tools;C:\\Windows");
      expect(env.Path).toBeUndefined();
    });

    it("adds the built-in skill variables the plugin manages", () => {
      const env = buildGitHubCopilotEnv({
        inherited: {},
        builtinSkillEnv: { COPILOT_OBSIDIAN_CLI: "C:\\Obsidian\\Obsidian.com" },
        home: "/h",
        settings: ALLOWED,
      });

      expect(env.COPILOT_OBSIDIAN_CLI).toBe("C:\\Obsidian\\Obsidian.com");
    });

    it(`removes vendor credentials last while vendor services are blocked, wherever they came from ${ISSUE}`, () => {
      const env = buildGitHubCopilotEnv({
        inherited: { [PLUS_ENV.baseUrl]: "https://vendor.example" },
        builtinSkillEnv: { [PLUS_ENV.licenseKey]: "license" },
        overrides: { [PLUS_ENV.userId]: "user" },
        home: "/h",
        settings: BLOCKED,
      });

      for (const key of Object.values(PLUS_ENV)) expect(env[key]).toBeUndefined();
      expect(env.COPILOT_HOME).toBe("/h");
    });

    it("keeps vendor variables when vendor services are allowed", () => {
      const env = buildGitHubCopilotEnv({
        inherited: {},
        builtinSkillEnv: { [PLUS_ENV.licenseKey]: "license" },
        home: "/h",
        settings: ALLOWED,
      });

      expect(env[PLUS_ENV.licenseKey]).toBe("license");
    });
  });
});
