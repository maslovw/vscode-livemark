import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the Mocha test runner
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 30000, // 30s timeout — custom editors can take time to open
  });

  const testsRoot = path.resolve(__dirname);

  // Find all compiled .test.js files in this directory
  const files = await glob("**/*.test.js", { cwd: testsRoot });

  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
