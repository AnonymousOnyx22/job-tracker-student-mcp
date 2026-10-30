import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { tools } from "../src/tools.js";
import { Store } from "../src/tracker.js";

/** A store that saves to a new temporary folder, so a test never touches real data. */
export function tempStore(): Store {
  return new Store(join(mkdtempSync(join(tmpdir(), "job-tracker-")), "applications.json"));
}

/** Runs a tool straight from src/tools.ts, with its input checked and its defaults filled in. */
export async function run(store: Store, name: string, args: Record<string, unknown> = {}) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`there is no tool called ${name}`);
  const parsed = z.object(tool.inputSchema).parse(args);
  return tool.run(parsed, store);
}
