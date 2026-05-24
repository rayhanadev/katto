import type { CliOptions } from "../types";

import { Katto } from "../sdk";

export async function runJson(options: CliOptions): Promise<void> {
  const katto = new Katto(options);
  for await (const progress of katto.scanWithProgress()) {
    if (options.jsonStream && progress.phase === "found") {
      console.log(JSON.stringify({ type: "result", result: katto.serialize(progress.entry) }));
    }
  }

  const entries = katto.entries;
  if (options.deleteAll) await katto.deleteAll(entries);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          stats: { ...katto.stats, elapsedMs: Date.now() - katto.stats.startedAt },
          results: katto.sort(entries).map((entry) => katto.serialize(entry)),
        },
        null,
        2,
      ),
    );
  }
}
