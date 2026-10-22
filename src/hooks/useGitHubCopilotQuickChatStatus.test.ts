import { renderHook, waitFor } from "@testing-library/react";
import { getGitHubCopilotSdkClient } from "@/LLMProviders/githubCopilot/githubCopilotClientRegistry";
import { useGitHubCopilotAccount, useGitHubCopilotModel } from "./useGitHubCopilotQuickChatStatus";

jest.mock("@/LLMProviders/githubCopilot/githubCopilotClientRegistry", () => ({
  getGitHubCopilotSdkClient: jest.fn(() => null),
}));

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";

function withClient(client: Record<string, unknown>): void {
  jest.mocked(getGitHubCopilotSdkClient).mockReturnValue(client as never);
}

describe("useGitHubCopilotQuickChatStatus", () => {
  afterEach(() => {
    jest.mocked(getGitHubCopilotSdkClient).mockReturnValue(null);
  });

  describe("useGitHubCopilotAccount()", () => {
    it(`reports the signed-in account from the running CLI, for ${ISSUE}`, async () => {
      withClient({
        getAccount: async () => ({
          authenticated: true,
          login: "octocat",
          host: "https://github.com",
        }),
      });

      const { result } = renderHook(() => useGitHubCopilotAccount());

      expect(result.current).toEqual({ kind: "checking" });
      await waitFor(() =>
        expect(result.current).toEqual({
          kind: "signed-in",
          login: "octocat",
          host: "https://github.com",
        })
      );
    });

    it("reports a signed-out CLI with its message", async () => {
      withClient({
        getAccount: async () => ({ authenticated: false, message: "No token" }),
      });

      const { result } = renderHook(() => useGitHubCopilotAccount());

      await waitFor(() =>
        expect(result.current).toEqual({ kind: "signed-out", message: "No token" })
      );
    });

    it("reports why the CLI can't be reached", async () => {
      withClient({
        getAccount: async () => {
          throw new Error("GitHub Copilot CLI not found.");
        },
      });

      const { result } = renderHook(() => useGitHubCopilotAccount());

      await waitFor(() => expect(result.current.kind).toBe("unavailable"));
    });

    it(`says GitHub Copilot needs the desktop app when no client runs, for ${ISSUE}`, () => {
      const { result } = renderHook(() => useGitHubCopilotAccount());

      expect(result.current).toEqual({
        kind: "unavailable",
        message: "GitHub Copilot models need the Obsidian desktop app.",
      });
    });
  });

  describe("useGitHubCopilotModel()", () => {
    it("reads a model's metadata from the running CLI", async () => {
      withClient({ getModel: async (id: string) => ({ id }) });

      const { result } = renderHook(() => useGitHubCopilotModel("claude-haiku-4.5"));

      await waitFor(() => expect(result.current).toEqual({ id: "claude-haiku-4.5" }));
    });

    it("returns nothing without a model id", () => {
      withClient({ getModel: jest.fn() });

      expect(renderHook(() => useGitHubCopilotModel(undefined)).result.current).toBeUndefined();
    });
  });
});
