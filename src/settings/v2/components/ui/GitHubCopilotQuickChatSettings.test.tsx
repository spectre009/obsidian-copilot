import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { GitHubCopilotQuickChatSettings } from "./GitHubCopilotQuickChatSettings";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

type Props = React.ComponentProps<typeof GitHubCopilotQuickChatSettings>;

function renderSettings(overrides: Partial<Props> = {}) {
  const props: Props = {
    account: { kind: "signed-in", login: "octocat", host: "https://github.com" },
    thinkingLevel: "default",
    onThinkingLevelChange: jest.fn(),
    contextWindow: "default",
    onContextWindowChange: jest.fn(),
    ...overrides,
  };
  render(<GitHubCopilotQuickChatSettings {...props} />);
  return props;
}

describe("GitHubCopilotQuickChatSettings", () => {
  describe("GitHubCopilotQuickChatSettings()", () => {
    it(`shows the signed-in account requests bill, for ${ISSUE}`, () => {
      renderSettings();

      expect(screen.getByText("octocat")).toBeTruthy();
      expect(screen.getByText(/on github\.com\. Requests bill/)).toBeTruthy();
    });

    it("tells a signed-out user how to sign in, and shows why the CLI is unavailable", () => {
      renderSettings({ account: { kind: "signed-out" } });
      expect(screen.getByText("copilot login")).toBeTruthy();

      renderSettings({
        account: { kind: "unavailable", message: "GitHub Copilot CLI not found." },
      });
      expect(screen.getByText(/GitHub Copilot CLI not found\./)).toBeTruthy();
    });

    it(`shows how many prompt tokens the selected model accepts on each tier next to the context setting, for ${ISSUE}`, () => {
      renderSettings({
        modelWindow: {
          modelLabel: "Claude Sonnet 5.5",
          defaultTokens: 200000,
          longContextTokens: 936000,
        },
      });

      expect(
        screen.getByText(
          /Claude Sonnet 5\.5: 200,000 prompt tokens\. Long context: 936,000 prompt tokens\./
        )
      ).toBeTruthy();
    });

    it("says when the selected model doesn't offer long context", () => {
      renderSettings({ modelWindow: { modelLabel: "Claude Haiku 4.5", defaultTokens: 136000 } });

      expect(screen.getByText(/It doesn't offer long context\./)).toBeTruthy();
    });

    it(`reports new thinking-level and context-window choices, for ${ISSUE}`, () => {
      const props = renderSettings();
      const [thinking, context] = screen.getAllByRole("combobox");

      fireEvent.change(thinking, { target: { value: "xhigh" } });
      fireEvent.change(context, { target: { value: "long_context" } });

      expect(props.onThinkingLevelChange).toHaveBeenCalledWith("xhigh");
      expect(props.onContextWindowChange).toHaveBeenCalledWith("long_context");
    });
  });
});
