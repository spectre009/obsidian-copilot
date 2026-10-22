import { ChainType } from "@/chainType";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { ChatToolControls } from "./ChatToolControls";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

function renderControls(overrides: Partial<React.ComponentProps<typeof ChatToolControls>> = {}) {
  const props: React.ComponentProps<typeof ChatToolControls> = {
    vaultToggle: true,
    setVaultToggle: jest.fn(),
    webToggle: false,
    setWebToggle: jest.fn(),
    composerToggle: false,
    setComposerToggle: jest.fn(),
    autonomousAgentToggle: false,
    setAutonomousAgentToggle: jest.fn(),
    currentChain: ChainType.COPILOT_PLUS_CHAIN,
    ...overrides,
  };
  const { container } = render(<ChatToolControls {...props} />);
  const icon = (name: string) => container.querySelector(`svg.lucide-${name}`);
  return { props, container, icon };
}

describe("ChatToolControls", () => {
  describe("ChatToolControls()", () => {
    it("offers the agent, vault and web controls in the note-finding mode by default", () => {
      const { icon } = renderControls();

      expect(icon("brain")).not.toBeNull();
      expect(icon("database")).not.toBeNull();
      expect(icon("globe")).not.toBeNull();
    });

    it(`hides web search while vendor services are blocked and the agent toggle for models that can't call tools, for ${ISSUE}`, () => {
      const { icon } = renderControls({ showWebSearch: false, showAutonomousAgent: false });

      expect(icon("brain")).toBeNull();
      expect(icon("globe")).toBeNull();
      expect(icon("database")).not.toBeNull();
    });

    it("turns vault search off and removes its pill", () => {
      const onVaultToggleOff = jest.fn();
      const { props, icon } = renderControls({ onVaultToggleOff });

      fireEvent.click(icon("database")!.closest("button")!);

      expect(props.setVaultToggle).toHaveBeenCalledWith(false);
      expect(onVaultToggleOff).toHaveBeenCalled();
    });

    it("renders nothing outside the note-finding mode", () => {
      const { container } = renderControls({ currentChain: ChainType.LLM_CHAIN });

      expect(container.innerHTML).toBe("");
    });
  });
});
