import { safeFetch } from "@/utils";
import { ImageProcessor } from "./imageProcessor";

jest.mock("@/utils", () => ({ safeFetch: jest.fn() }));
jest.mock("@/logger", () => ({ logError: jest.fn(), logWarn: jest.fn() }));

function imageResponse(contentType: string, bytes: number[]): Response {
  return {
    ok: true,
    statusText: "OK",
    headers: { get: () => contentType },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Response;
}

describe("imageProcessor", () => {
  describe("ImageProcessor", () => {
    describe("webImageToDataUrl()", () => {
      it("returns a web image as a data URL with its content type (https://github.com/spectre009/obsidian-copilot/issues/3)", async () => {
        jest.mocked(safeFetch).mockResolvedValue(imageResponse("image/png", [1, 2, 3]));

        await expect(ImageProcessor.webImageToDataUrl("https://example.com/a.png")).resolves.toBe(
          "data:image/png;base64,AQID"
        );
      });

      it("returns null for a response that isn't an image", async () => {
        jest.mocked(safeFetch).mockResolvedValue(imageResponse("text/html", [1]));

        await expect(
          ImageProcessor.webImageToDataUrl("https://example.com/page")
        ).resolves.toBeNull();
      });
    });
  });
});
