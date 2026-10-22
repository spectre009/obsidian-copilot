import { GitHubCopilotContextWindowSetting } from "@/agentMode/backends/github-copilot/ui/GitHubCopilotContextWindowSetting";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

describe("GitHubCopilotContextWindowSetting", () => {
  describe("GitHubCopilotContextWindowSetting()", () => {
    it("shows the default tier when none is stored and reports a switch to long context (https://github.com/spectre009/obsidian-copilot/issues/3)", () => {
      const onChange = jest.fn();
      render(<GitHubCopilotContextWindowSetting value={undefined} onChange={onChange} />);

      expect(screen.getByDisplayValue("Default")).toBeTruthy();
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "long_context" } });
      expect(onChange).toHaveBeenCalledWith("long_context");
    });
  });
});
