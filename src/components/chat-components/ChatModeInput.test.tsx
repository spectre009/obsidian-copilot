import { ChainType } from "@/chainType";
import { act, render } from "@testing-library/react";
import React from "react";
import ChatModeInput from "./ChatModeInput";

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

let mockChain = ChainType.COPILOT_PLUS_CHAIN;
let mockSettings = { enableAutonomousAgent: true, blockVendorServices: true };
let mockCanCallTools = false;
let toolControlProps: Record<string, unknown> = {};
let chatInputProps: Record<string, unknown> = {};

jest.mock("@/aiParams", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useChainType: () => [mockChain, jest.fn()],
}));
jest.mock("@/settings/model", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useSettingsValue: () => mockSettings,
}));
jest.mock("@/hooks/useQuickChatModelCanCallTools", () => ({
  // eslint-disable-next-line @eslint-react/hooks-extra/no-unnecessary-use-prefix -- mocks the public hook
  useQuickChatModelCanCallTools: () => mockCanCallTools,
}));
jest.mock("./ChatToolControls", () => ({
  ChatToolControls: (props: Record<string, unknown>) => {
    toolControlProps = props;
    return null;
  },
}));
jest.mock("./ChatInput", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: Record<string, unknown>, _ref) => {
      chatInputProps = props;
      return ReactModule.createElement(ReactModule.Fragment, null, props.toolControls as never);
    }),
  };
});

function renderInput(inputMessage = "what did I write about gardening?") {
  const handleSendMessage = jest.fn();
  render(
    <ChatModeInput
      {...({ handleSendMessage, inputMessage } as unknown as React.ComponentProps<
        typeof ChatModeInput
      >)}
    />
  );
  const send = () =>
    act(() => {
      (chatInputProps.handleSendMessage as (metadata: object) => void)({});
    });
  return { handleSendMessage, send };
}

describe("ChatModeInput", () => {
  beforeEach(() => {
    mockChain = ChainType.COPILOT_PLUS_CHAIN;
    mockSettings = { enableAutonomousAgent: true, blockVendorServices: true };
    mockCanCallTools = false;
  });

  describe("ChatModeInput()", () => {
    it(`treats a model that can't call tools as non-autonomous, hiding the agent and web controls in vault chat, for ${ISSUE}`, () => {
      renderInput();

      expect(toolControlProps).toMatchObject({
        autonomousAgentToggle: false,
        showAutonomousAgent: false,
        showWebSearch: false,
      });
    });

    it(`turns vault search on when entering vault chat and adds @vault to an ordinary question, for ${ISSUE}`, () => {
      const { handleSendMessage, send } = renderInput();

      expect(toolControlProps.vaultToggle).toBe(true);
      send();
      expect(handleSendMessage).toHaveBeenCalledWith({ toolCalls: ["@vault"] });
    });

    it(`never adds web search while vendor services are blocked, for ${ISSUE}`, () => {
      const { handleSendMessage, send } = renderInput();
      act(() => (toolControlProps.setWebToggle as (value: boolean) => void)(true));

      send();

      expect(handleSendMessage).toHaveBeenCalledWith({ toolCalls: ["@vault"] });
    });

    it("leaves tool choice to the agent for a model that can call tools", () => {
      mockCanCallTools = true;
      const { handleSendMessage, send } = renderInput();

      expect(toolControlProps).toMatchObject({
        autonomousAgentToggle: true,
        showAutonomousAgent: true,
      });
      send();
      expect(handleSendMessage).toHaveBeenCalledWith({});
    });

    it("keeps vault search off by default when vendor services are allowed", () => {
      mockSettings = { enableAutonomousAgent: false, blockVendorServices: false };
      mockCanCallTools = true;
      renderInput();

      expect(toolControlProps).toMatchObject({ vaultToggle: false, showWebSearch: true });
    });
  });
});
