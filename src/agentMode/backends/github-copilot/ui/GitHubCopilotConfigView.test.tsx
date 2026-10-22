import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import {
  GitHubCopilotConfigView,
  type GitHubCopilotConfigViewProps,
} from "./GitHubCopilotConfigView";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/2";
const PROMPT = process.platform === "win32" ? "PS> " : "$ ";

const commandBlock =
  (command: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.tagName === "CODE" && element.textContent === `${PROMPT}${command}`;

function renderView(overrides: Partial<GitHubCopilotConfigViewProps> = {}): void {
  render(
    <GitHubCopilotConfigView
      state={{ kind: "absent" }}
      binaryPath=""
      hasBinaryPathOverride={false}
      onSavePath={jest.fn().mockResolvedValue(null)}
      onClearPath={jest.fn()}
      detect={jest.fn().mockResolvedValue(null)}
      searchedDirs={() => []}
      installCommand="winget install GitHub.Copilot"
      signInCommand="copilot login"
      platform="win32"
      onClose={jest.fn()}
      {...overrides}
    />
  );
}

describe("GitHubCopilotConfigView", () => {
  describe("GitHubCopilotConfigView()", () => {
    it(`offers the platform's install command and guided terminal sign-in rather than an integrated flow ${ISSUE}`, () => {
      renderView();

      expect(screen.getByRole("heading", { name: "Install GitHub Copilot CLI" })).toBeTruthy();
      expect(screen.getByText(commandBlock("winget install GitHub.Copilot"))).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
      expect(screen.getByText(commandBlock("copilot login"))).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Sign in with your browser/ })).toBeNull();
    });

    it("shows an auto-detected CLI without offering to apply or clear it until the path is edited", () => {
      renderView({
        state: { kind: "ready", source: "managed" },
        binaryPath: "C:\\Tools\\copilot.exe",
      });

      expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
      fireEvent.change(screen.getByDisplayValue("C:\\Tools\\copilot.exe"), {
        target: { value: "D:\\copilot.exe" },
      });
      expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
    });

    it("lets the user clear a path they set", async () => {
      const onClearPath = jest.fn();
      renderView({
        state: { kind: "ready", source: "custom" },
        binaryPath: "D:\\copilot.exe",
        hasBinaryPathOverride: true,
        onClearPath,
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      });
      expect(onClearPath).toHaveBeenCalledTimes(1);
    });

    it("warns with the version message when the installed CLI is too old", () => {
      renderView({
        state: {
          kind: "incompatible",
          source: "managed",
          currentVersion: "1.0.90",
          minVersion: "1.0.102",
          message: "GitHub Copilot CLI v1.0.90 is not supported.",
        },
        binaryPath: "C:\\Tools\\copilot.exe",
      });

      expect(screen.getByRole("alert").textContent).toContain(
        "GitHub Copilot CLI v1.0.90 is not supported."
      );
    });

    it("mentions the WinGet folder only on Windows, where Auto-detect searches it", () => {
      renderView({ platform: "darwin" });
      expect(screen.getByText(/Auto-detect checks your PATH\./)).toBeTruthy();
    });
  });
});
