import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./core/tools.js";
import { tools } from "./tools.js";
import { Store } from "./tracker.js";

export const VERSION = "0.1.0";

export function createServer(store: Store = new Store()): McpServer {
  const server = new McpServer({ name: "job-application-tracker-mcp", version: VERSION });
  registerTools(server, tools, store);
  return server;
}
