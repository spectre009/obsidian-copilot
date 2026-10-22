import { getSettings } from "@/settings/model";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { updateGitHubCopilotFields } from "./descriptor";
import { GitHubCopilotSettingsPanel } from "./GitHubCopilotSettingsPanel";

jest.mock("./descriptor", () => ({ updateGitHubCopilotFields: jest.fn() }));
jest.mock("@/settings/model", () => ({
  getSettings: jest.fn(),
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useSettingsValue: () => jest.requireMock("@/settings/model").getSettings(),
}));

function renderPanel(contextWindow?: "long_context") {
  jest.mocked(getSettings).mockReturnValue({
    agentMode: { backends: { "github-copilot": { contextWindow } } },
  } as never);
  render(<GitHubCopilotSettingsPanel plugin={{} as never} app={{} as never} />);
}

describe("GitHubCopilotSettingsPanel", () => {
  describe("GitHubCopilotSettingsPanel()", () => {
    it("stores the long-context tier and clears the field when switched back to the default (https://github.com/spectre009/obsidian-copilot/issues/3)", () => {
      renderPanel("long_context");
      const select = screen.getByDisplayValue("Long context");

      fireEvent.change(select, { target: { value: "default" } });
      expect(updateGitHubCopilotFields).toHaveBeenLastCalledWith({ contextWindow: undefined });

      fireEvent.change(select, { target: { value: "long_context" } });
      expect(updateGitHubCopilotFields).toHaveBeenLastCalledWith({ contextWindow: "long_context" });
    });
  });
});
