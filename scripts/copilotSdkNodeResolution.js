"use strict";

const path = require("node:path");

const SDK_PACKAGE_DIR = /[/\\]node_modules[/\\]@github[/\\]copilot-sdk[/\\]/;
const JSONRPC_NODE_ENTRY = /^vscode-jsonrpc\/node(?:\.js)?$/;

/**
 * Externals the GitHub Copilot SDK needs at runtime on desktop: `net` for its JSON-RPC
 * transport and `koffi` for an in-process runtime host the plugin never starts. Both are
 * reached only after the SDK's lazy import, so the mobile load path never requires them.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
const COPILOT_SDK_EXTERNALS = ["net", "koffi"];

/**
 * Resolves the GitHub Copilot SDK's `vscode-jsonrpc/node` import to the Node implementation.
 *
 * The plugin bundles with esbuild's browser resolution, which honours `vscode-jsonrpc`'s
 * `browser` map (`lib/node/main.js` → `lib/browser/main.js`); the SDK then fails at import with
 * "Class extends value undefined". The mapping is scoped to imports made from inside the SDK so
 * every other package keeps the plugin's resolution.
 * https://github.com/spectre009/obsidian-copilot/issues/3
 */
const copilotSdkNodeResolution = {
  name: "copilot-sdk-node-resolution",
  setup(build) {
    build.onResolve({ filter: JSONRPC_NODE_ENTRY }, (args) => {
      if (!SDK_PACKAGE_DIR.test(args.importer)) return undefined;
      const resolved = require.resolve("vscode-jsonrpc/lib/node/main.js", {
        paths: [args.resolveDir],
      });
      return { path: path.normalize(resolved) };
    });
  },
};

module.exports = { COPILOT_SDK_EXTERNALS, copilotSdkNodeResolution };
