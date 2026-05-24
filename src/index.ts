#!/usr/bin/env bun
import { runJson } from "./cli/json";
import { parseOptions } from "./cli/options";
import { runTui } from "./tui/app";

async function main(): Promise<void> {
  try {
    const options = await parseOptions(Bun.argv.slice(2));
    if (options.json || options.jsonStream) {
      await runJson(options);
      return;
    }

    await runTui(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();
