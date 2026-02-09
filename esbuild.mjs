import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");
const buildTests = process.argv.includes("--tests");

// Main extension build
const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !isWatch,
});

// Test builds — only when --tests flag is passed or during a non-watch build
const testConfigs = buildTests
  ? [
      {
        entryPoints: ["src/test/runTest.ts"],
        bundle: true,
        outfile: "dist/test/runTest.js",
        external: ["vscode", "@vscode/test-electron"],
        format: "cjs",
        platform: "node",
        target: "node18",
        sourcemap: true,
      },
      {
        entryPoints: ["src/test/suite/index.ts"],
        bundle: true,
        outfile: "dist/test/suite/index.js",
        external: ["vscode", "mocha", "glob"],
        format: "cjs",
        platform: "node",
        target: "node18",
        sourcemap: true,
      },
      {
        entryPoints: ["src/test/suite/extension.test.ts"],
        bundle: true,
        outfile: "dist/test/suite/extension.test.js",
        external: ["vscode", "mocha", "assert"],
        format: "cjs",
        platform: "node",
        target: "node18",
        sourcemap: true,
      },
    ]
  : [];

if (isWatch) {
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Extension build complete.");

  // Build test files
  for (const config of testConfigs) {
    const testCtx = await esbuild.context(config);
    await testCtx.rebuild();
    await testCtx.dispose();
  }
  if (testConfigs.length > 0) {
    console.log("Test build complete.");
  }
}
