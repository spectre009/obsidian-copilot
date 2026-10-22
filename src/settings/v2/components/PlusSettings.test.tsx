import { DEFAULT_SETTINGS } from "@/constants";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const updateSetting = jest.fn<void, unknown[]>();
const mockApp = {};
let currentSettings = { ...DEFAULT_SETTINGS };
jest.mock("@/settings/model", () => ({
  updateSetting: (...a: unknown[]) => updateSetting(...a),
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the real hook; name must match the export
  useSettingsValue: () => currentSettings,
}));

let mockLicenseState: { status: string; plan?: string } = { status: "none" };
let mockIsPaidUser: boolean | undefined = false;
const checkIsPaidUser = jest.fn<Promise<boolean | undefined>, unknown[]>();
jest.mock("@/plusUtils", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the real hook
  useLicenseState: () => mockLicenseState,
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the real hook
  useIsPaidUser: () => mockIsPaidUser,
  checkIsPaidUser: (...a: unknown[]) => checkIsPaidUser(...a),
  navigateToPlusPage: jest.fn(),
}));

jest.mock("@/context", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the real hook
  useApp: () => mockApp,
}));

jest.mock("@/components/modals/CopilotPlusWelcomeModal", () => ({
  CopilotPlusWelcomeModal: class {
    open() {}
  },
}));

import { PlusSettings } from "./PlusSettings";

describe("PlusSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSettings = { ...DEFAULT_SETTINGS, blockVendorServices: false };
    mockLicenseState = { status: "none" };
    mockIsPaidUser = false;
  });

  describe("PlusSettings()", () => {
    it("https://github.com/spectre009/obsidian-copilot/issues/1 shows only the switched-on Block vendor services toggle and its explanation while blocked, with no license entry or upsell", () => {
      currentSettings = { ...DEFAULT_SETTINGS, blockVendorServices: true };

      render(<PlusSettings />);

      expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText(/Your stored license and model settings are kept/)).toBeTruthy();
      expect(screen.queryByPlaceholderText("Enter your license key")).toBeNull();
      expect(screen.queryByRole("link", { name: "Copilot paid plans" })).toBeNull();
      expect(screen.queryByText("Copilot License")).toBeNull();
    });

    it("turns Block vendor services off through the setting when the user flips the toggle", () => {
      currentSettings = { ...DEFAULT_SETTINGS, blockVendorServices: true };
      render(<PlusSettings />);

      fireEvent.click(screen.getByRole("switch"));

      expect(updateSetting).toHaveBeenCalledWith("blockVendorServices", false);
    });

    it("shows the toggle switched off above the license section while vendor services are allowed", () => {
      render(<PlusSettings />);

      expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByPlaceholderText("Enter your license key")).toBeTruthy();
    });

    it("attributes the license link and pairing CTA to distinct Copilot surfaces", () => {
      render(<PlusSettings />);

      expect(screen.getByRole("link", { name: "Miyo" }).getAttribute("href")).toBe(
        "https://www.miyo.md/?utm_source=obsidian_copilot&utm_medium=license_settings"
      );
      expect(
        screen.getByRole("link", { name: "New: pair Copilot with Miyo" }).getAttribute("href")
      ).toBe("https://www.miyo.md/?utm_source=obsidian_copilot&utm_medium=pairing");
    });

    it("sends the paid plans link to pricing with settings attribution — https://github.com/Brevilabs/obsidian-copilot-private/issues/640", () => {
      render(<PlusSettings />);

      expect(screen.getByRole("link", { name: "Copilot paid plans" }).getAttribute("href")).toBe(
        "https://www.obsidiancopilot.com/pricing?utm_source=obsidian_copilot&utm_medium=settings"
      );
    });

    it("names a lifetime purchase Lifetime rather than its stored plan", () => {
      mockLicenseState = { status: "active", plan: "believer" };
      mockIsPaidUser = true;

      render(<PlusSettings />);

      expect(screen.getByText("Lifetime")).toBeTruthy();
      expect(screen.queryByText(/believer/i)).toBeNull();
    });

    it("shows a recurring plan under its own name", () => {
      mockLicenseState = { status: "active", plan: "lite" };
      mockIsPaidUser = true;

      render(<PlusSettings />);

      expect(screen.getByText("lite")).toBeTruthy();
    });

    it("reports a stored key that grants nothing as inactive, alongside the pitch", () => {
      mockLicenseState = { status: "inactive" };

      render(<PlusSettings />);

      expect(screen.getByText("Inactive")).toBeTruthy();
      expect(screen.getByText("All of it for a few dollars a month.")).toBeTruthy();
    });

    it("says nothing about a key while its validation is still in flight", async () => {
      mockLicenseState = { status: "inactive" };
      let resolveValidation: (value: boolean) => void = () => {};
      checkIsPaidUser.mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveValidation = resolve;
        })
      );

      render(<PlusSettings />);
      act(() => {
        screen.getByRole("button", { name: "Apply" }).click();
      });

      expect(checkIsPaidUser).toHaveBeenCalledWith(mockApp, { trigger: "manual" });
      expect(screen.queryByText("Inactive")).toBeNull();
      expect(screen.queryByText("All of it for a few dollars a month.")).toBeNull();

      await act(async () => {
        resolveValidation(true);
      });

      expect(screen.getByText("Inactive")).toBeTruthy();
    });
  });
});
