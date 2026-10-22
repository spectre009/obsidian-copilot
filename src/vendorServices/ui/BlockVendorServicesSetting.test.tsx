import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { BlockVendorServicesSetting } from "./BlockVendorServicesSetting";

describe("BlockVendorServicesSetting", () => {
  describe("BlockVendorServicesSetting()", () => {
    it("names the blocked vendors and explains what stays off while blocked", () => {
      render(<BlockVendorServicesSetting blocked onBlockedChange={jest.fn()} />);

      expect(screen.getByText("Block vendor services")).toBeTruthy();
      expect(screen.getByText(/Brevilabs and OpenArtifacts/)).toBeTruthy();
      expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText(/Your stored license and model settings are kept/)).toBeTruthy();
    });

    it("hides the explanation while vendor services are allowed", () => {
      render(<BlockVendorServicesSetting blocked={false} onBlockedChange={jest.fn()} />);

      expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
      expect(screen.queryByText(/Your stored license and model settings are kept/)).toBeNull();
    });

    it("reports the new value when the switch is flipped", () => {
      const onBlockedChange = jest.fn();
      render(<BlockVendorServicesSetting blocked={false} onBlockedChange={onBlockedChange} />);

      fireEvent.click(screen.getByRole("switch"));

      expect(onBlockedChange).toHaveBeenCalledWith(true);
    });
  });
});
