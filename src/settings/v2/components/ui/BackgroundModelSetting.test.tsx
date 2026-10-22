import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { BackgroundModelSetting, SAME_AS_CHAT_MODEL } from "./BackgroundModelSetting";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

function renderSetting(
  overrides: Partial<React.ComponentProps<typeof BackgroundModelSetting>> = {}
) {
  const props = {
    value: "haiku",
    options: [
      { label: "Claude Haiku 4.5", value: "haiku" },
      { label: "Claude Sonnet 5.5", value: "sonnet" },
    ],
    onChange: jest.fn(),
    thinkingLevel: "low" as const,
    onThinkingLevelChange: jest.fn(),
    ...overrides,
  };
  render(<BackgroundModelSetting {...props} />);
  return props;
}

describe("BackgroundModelSetting", () => {
  describe("BackgroundModelSetting()", () => {
    it(`offers "Same as chat model" ahead of the enabled Quick Chat models and reports a pick, for ${ISSUE}`, () => {
      const props = renderSetting();
      const [modelSelect] = screen.getAllByRole("combobox");

      expect(screen.getByDisplayValue("Claude Haiku 4.5")).toBeTruthy();
      expect(
        Array.from((modelSelect as HTMLSelectElement).options).map((option) => option.text)
      ).toEqual(["Same as chat model", "Claude Haiku 4.5", "Claude Sonnet 5.5"]);

      fireEvent.change(modelSelect, { target: { value: SAME_AS_CHAT_MODEL } });
      expect(props.onChange).toHaveBeenCalledWith(SAME_AS_CHAT_MODEL);
    });

    it(`reports a new background thinking level, for ${ISSUE}`, () => {
      const props = renderSetting();
      const [, thinkingSelect] = screen.getAllByRole("combobox");

      fireEvent.change(thinkingSelect, { target: { value: "high" } });

      expect(props.onThinkingLevelChange).toHaveBeenCalledWith("high");
    });
  });
});
