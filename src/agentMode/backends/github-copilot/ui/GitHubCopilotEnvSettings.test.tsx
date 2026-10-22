import { render, screen } from "@testing-library/react";
import React from "react";
import { GitHubCopilotEnvSettings } from "./GitHubCopilotEnvSettings";

describe("GitHubCopilotEnvSettings", () => {
  describe("GitHubCopilotEnvSettings()", () => {
    it("shows the saved variables and says which ones Copilot sets itself (https://github.com/spectre009/obsidian-copilot/issues/2)", () => {
      render(
        <GitHubCopilotEnvSettings
          value={{ HTTPS_PROXY: "http://proxy:8080" }}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByDisplayValue("HTTPS_PROXY")).toBeTruthy();
      expect(screen.getByDisplayValue("http://proxy:8080")).toBeTruthy();
      expect(screen.getByText(/so overrides for them are ignored/).textContent).toContain(
        "COPILOT_*"
      );
    });
  });
});
