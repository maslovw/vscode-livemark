import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest (package.json)
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the test runner script (compiled from suite/index.ts)
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Create a temporary workspace folder for test fixtures
    const testWorkspace = path.resolve(
      extensionDevelopmentPath,
      "src",
      "test",
      "fixtures"
    );

    // Download VS Code, unzip it, and run the integration tests
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        "--disable-extensions", // Disable other extensions to avoid interference
      ],
    });
  } catch (err) {
    console.error("Failed to run tests:", err);
    process.exit(1);
  }
}

main();
