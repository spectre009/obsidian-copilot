import { ChatModelProviders } from "@/constants";
import { checkIsPaidUser } from "@/plusUtils";
import { getSettings } from "@/settings/model";
import {
  canRunVaultChat,
  configuredModelCanCallTools,
  isEffectivelyAutonomous,
  modelCanCallTools,
  withoutVendorTools,
} from "./localVaultChat";

jest.mock("@/plusUtils", () => ({ checkIsPaidUser: jest.fn(async () => false) }));
jest.mock("@/settings/model", () => ({
  getSettings: jest.fn(() => ({ blockVendorServices: true })),
}));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";
const BLOCKED = { blockVendorServices: true };
const ALLOWED = { blockVendorServices: false };

describe("localVaultChat", () => {
  describe("canRunVaultChat()", () => {
    it(`runs vault chat without a license check while vendor services are blocked, for ${ISSUE}`, async () => {
      await expect(canRunVaultChat(undefined, { trigger: "legacy_chat_turn" })).resolves.toBe(true);
      expect(checkIsPaidUser).not.toHaveBeenCalled();
    });

    it("leaves the decision to the license when vendor services are allowed", async () => {
      jest.mocked(getSettings).mockReturnValue(ALLOWED as never);

      await expect(canRunVaultChat(undefined, { trigger: "legacy_chat_turn" })).resolves.toBe(
        false
      );
      expect(checkIsPaidUser).toHaveBeenCalledWith(undefined, { trigger: "legacy_chat_turn" });
    });
  });

  describe("withoutVendorTools()", () => {
    const tools = [
      { name: "localSearch" },
      { name: "webSearch" },
      { name: "youtubeTranscription" },
    ];

    it(`drops web search and YouTube transcription while vendor services are blocked, for ${ISSUE}`, () => {
      expect(withoutVendorTools(tools, BLOCKED)).toEqual([{ name: "localSearch" }]);
    });

    it("keeps every tool when vendor services are allowed", () => {
      expect(withoutVendorTools(tools, ALLOWED)).toEqual(tools);
    });
  });

  describe("modelCanCallTools()", () => {
    it("reports native tool calling from the model instance's bindTools", () => {
      expect(modelCanCallTools({ bindTools: () => undefined })).toBe(true);
      expect(modelCanCallTools({})).toBe(false);
      expect(modelCanCallTools(null)).toBe(false);
    });
  });

  describe("configuredModelCanCallTools()", () => {
    it(`reports GitHub Copilot models as unable to call tools, for ${ISSUE}`, () => {
      expect(configuredModelCanCallTools({ provider: ChatModelProviders.GITHUB_COPILOT })).toBe(
        false
      );
      expect(configuredModelCanCallTools({ provider: ChatModelProviders.OPENAI })).toBe(true);
      expect(configuredModelCanCallTools(null)).toBe(true);
    });
  });

  describe("isEffectivelyAutonomous()", () => {
    it(`runs the agent only when the setting is on and the model can call tools, for ${ISSUE}`, () => {
      expect(isEffectivelyAutonomous({ enableAutonomousAgent: true }, true)).toBe(true);
      expect(isEffectivelyAutonomous({ enableAutonomousAgent: true }, false)).toBe(false);
      expect(isEffectivelyAutonomous({ enableAutonomousAgent: false }, true)).toBe(false);
    });
  });
});
