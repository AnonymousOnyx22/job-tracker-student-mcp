#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, VERSION } from "./server.js";
import { Store } from "./tracker.js";

function usage(): void {
  console.log(`job-application-tracker-mcp ${VERSION}

Track internships, jobs, interviews and deadlines offline (MCP).

Add it to your app's MCP config with command "npx" and args ["-y", "job-application-tracker-mcp"].
Applications are saved in one JSON file. Set JOB_TRACKER_FILE to choose where.

  --help, --version`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h") return usage();
  if (cmd === "--version" || cmd === "-v") return console.log(VERSION);
  const store = new Store();
  await createServer(store).connect(new StdioServerTransport());
  console.error(`job-application-tracker-mcp ${VERSION} running, saving to ${store.path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
