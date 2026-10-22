// Bundles the GitHub Copilot SDK loader with the plugin's own esbuild options, then evaluates the
// bundle the way Obsidian's desktop renderer does (CommonJS, Node's require, a `window` global) and
// imports the SDK through it. Prints one JSON line: { ok, client, forStdio } or { ok: false, error }.
// https://github.com/spectre009/obsidian-copilot/issues/3
//
// Usage: node scripts/copilotSdkBundleProbe.mjs <outDir> [without-resolver]
import esbuild from "esbuild";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { runInThisContext } from "vm";
import { createBuildOptions } from "../esbuild.config.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [outDir, variant] = process.argv.slice(2);
const outfile = join(outDir, "copilot-sdk-loader.js");

try {
  const options = createBuildOptions({ production: false });
  const plugins =
    variant === "without-resolver"
      ? options.plugins.filter((plugin) => plugin.name !== "copilot-sdk-node-resolution")
      : options.plugins;
  await esbuild.build({
    ...options,
    absWorkingDir: repoRoot,
    entryPoints: [
      join(repoRoot, "src", "LLMProviders", "githubCopilot", "githubCopilotSdkLoader.ts"),
    ],
    outfile,
    plugins,
    sourcemap: false,
    minify: true,
    logLevel: "silent",
  });

  const nodeRequire = createRequire(outfile);
  const obsidian = { Platform: { isDesktopApp: true, isMobile: false } };
  const module = { exports: {} };
  // The bundle maps Node's `global` to the renderer's `window`, which Node lacks.
  // https://github.com/spectre009/obsidian-copilot/issues/3
  const nodeGlobal = runInThisContext("globalThis");
  nodeGlobal.window = nodeGlobal;
  new Function(
    "require",
    "module",
    "exports",
    "__filename",
    "__dirname",
    readFileSync(outfile, "utf8")
  )(
    (id) => (id === "obsidian" ? obsidian : nodeRequire(id)),
    module,
    module.exports,
    outfile,
    outDir
  );
  const sdk = await module.exports.loadGitHubCopilotSdk();
  console.log(
    JSON.stringify({
      ok: true,
      client: typeof sdk.CopilotClient,
      forStdio: typeof sdk.RuntimeConnection?.forStdio,
    })
  );
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
}
