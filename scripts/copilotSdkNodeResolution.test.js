"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  COPILOT_SDK_EXTERNALS,
  copilotSdkNodeResolution,
} = require("./copilotSdkNodeResolution.js");

const ISSUE = "https://github.com/spectre009/obsidian-copilot/issues/3";
const PROBE = path.join(__dirname, "copilotSdkBundleProbe.mjs");

function runProbe(outDir, variant) {
  const args = [PROBE, outDir, ...(variant ? [variant] : [])];
  const stdout = execFileSync(process.execPath, args, { encoding: "utf8" });
  return JSON.parse(stdout.trim().split("\n").pop());
}

describe("copilotSdkNodeResolution", () => {
  describe("copilotSdkNodeResolution.setup()", () => {
    function resolveFrom(importer, importPath) {
      let onResolve;
      copilotSdkNodeResolution.setup({
        onResolve: (_options, callback) => {
          onResolve = callback;
        },
      });
      return onResolve({ path: importPath, importer, resolveDir: path.dirname(importer) });
    }

    const sdkFile = path.join(
      __dirname,
      "..",
      "node_modules",
      "@github",
      "copilot-sdk",
      "dist",
      "session.js"
    );

    it(`maps the SDK's vscode-jsonrpc/node import to the Node implementation for ${ISSUE}`, () => {
      const result = resolveFrom(sdkFile, "vscode-jsonrpc/node.js");

      expect(result.path).toMatch(/vscode-jsonrpc[/\\]lib[/\\]node[/\\]main\.js$/);
    });

    it(`leaves vscode-jsonrpc imports from other packages to the plugin's resolution for ${ISSUE}`, () => {
      const otherFile = path.join(__dirname, "..", "node_modules", "other", "index.js");

      expect(resolveFrom(otherFile, "vscode-jsonrpc/node")).toBeUndefined();
    });
  });

  describe("COPILOT_SDK_EXTERNALS", () => {
    it(`marks the SDK's transport and in-process host modules as externals for ${ISSUE}`, () => {
      expect(COPILOT_SDK_EXTERNALS).toEqual(["net", "koffi"]);
    });
  });

  // Exercises the resolver together with the real build options and the SDK package. https://github.com/spectre009/obsidian-copilot/issues/3
  describe("bundled SDK import", () => {
    let outDir;

    beforeEach(() => {
      outDir = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-sdk-bundle "));
    });

    afterEach(() => {
      fs.rmSync(outDir, { force: true, recursive: true });
    });

    it(`imports the SDK from a bundle built with the plugin's esbuild options for ${ISSUE}`, () => {
      expect(runProbe(outDir)).toEqual({ ok: true, client: "function", forStdio: "function" });
    }, 60_000);

    it(`fails to import the SDK without the resolver, so the bundle check has teeth, for ${ISSUE}`, () => {
      const result = runProbe(outDir, "without-resolver");

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Class extends value/);
    }, 60_000);
  });
});
