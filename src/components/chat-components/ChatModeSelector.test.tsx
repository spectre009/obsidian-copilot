import { ChainType } from "@/chainType";
import { ChatModeSelector } from "@/components/chat-components/ChatModeSelector";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

describe("ChatModeSelector", () => {
  beforeAll(() => {
    (window as unknown as { activeDocument: Document }).activeDocument = window.document;
    if (!("PointerEvent" in window)) {
      (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
    }
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  describe("ChatModeSelector()", () => {
    it("offers Free Chat and paid Copilot Plus without Vault QA https://github.com/Brevilabs/obsidian-copilot-private/issues/286", () => {
      const onModeChange = jest.fn();
      render(
        <ChatModeSelector
          selectedChain={ChainType.LLM_CHAIN}
          isPaidUser
          onModeChange={onModeChange}
          onPlusUpsell={jest.fn()}
          defaultOpen
        />
      );

      expect(screen.getAllByText("Chat (free)")).toHaveLength(2);
      expect(screen.getByText("Copilot Plus")).toBeTruthy();
      expect(screen.queryByText(/vault QA/i)).toBeNull();

      fireEvent.click(screen.getByText("Copilot Plus"));
      expect(onModeChange).toHaveBeenCalledWith(ChainType.COPILOT_PLUS_CHAIN);
    });

    it("switches from Copilot Plus back to Free Chat https://github.com/Brevilabs/obsidian-copilot-private/issues/286", () => {
      const onModeChange = jest.fn();
      render(
        <ChatModeSelector
          selectedChain={ChainType.COPILOT_PLUS_CHAIN}
          isPaidUser
          onModeChange={onModeChange}
          onPlusUpsell={jest.fn()}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText("Chat (free)"));
      expect(onModeChange).toHaveBeenCalledWith(ChainType.LLM_CHAIN);
    });

    it("https://github.com/spectre009/obsidian-copilot/issues/3 offers chat and vault chat, with no Copilot Plus item or upsell, while vendor services are blocked", () => {
      const onModeChange = jest.fn();
      const onPlusUpsell = jest.fn();
      render(
        <ChatModeSelector
          selectedChain={ChainType.LLM_CHAIN}
          isPaidUser={false}
          vaultChat
          onModeChange={onModeChange}
          onPlusUpsell={onPlusUpsell}
          defaultOpen
        />
      );

      expect(screen.getAllByText("Chat")).toHaveLength(2);
      expect(screen.queryByText("Copilot Plus")).toBeNull();
      expect(screen.getAllByRole("menuitem")).toHaveLength(2);

      fireEvent.click(screen.getByText("Vault chat"));
      expect(onModeChange).toHaveBeenCalledWith(ChainType.COPILOT_PLUS_CHAIN);
      expect(onPlusUpsell).not.toHaveBeenCalled();
    });

    it("https://github.com/spectre009/obsidian-copilot/issues/3 labels the selected note-finding mode vault chat while vendor services are blocked", () => {
      render(
        <ChatModeSelector
          selectedChain={ChainType.COPILOT_PLUS_CHAIN}
          isPaidUser
          vaultChat
          onModeChange={jest.fn()}
          onPlusUpsell={jest.fn()}
          defaultOpen
        />
      );

      expect(screen.getAllByText("Vault chat")).toHaveLength(2);
    });

    it("keeps the Copilot Plus upsell for free users https://github.com/Brevilabs/obsidian-copilot-private/issues/286", () => {
      const onPlusUpsell = jest.fn();
      render(
        <ChatModeSelector
          selectedChain={ChainType.LLM_CHAIN}
          isPaidUser={false}
          onModeChange={jest.fn()}
          onPlusUpsell={onPlusUpsell}
          defaultOpen
        />
      );

      fireEvent.click(screen.getByText("Copilot Plus"));
      expect(onPlusUpsell).toHaveBeenCalledTimes(1);
    });
  });
});
