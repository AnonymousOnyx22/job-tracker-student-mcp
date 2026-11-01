import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type Shape = Record<string, z.ZodTypeAny>;

export interface ToolOutput {
  /** The answer in words. */
  text: string;
  /** The same answer as fields, shaped by the output schema of the tool. */
  structured: Record<string, unknown>;
}

export interface ToolDef<Api> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  /** The shape of the fields the tool returns, so a client can read them. */
  outputSchema?: Shape;
  /** True when the tool never changes the saved applications. */
  readOnly: boolean;
  /** True when the tool permanently removes saved data. Defaults to false. */
  destructive?: boolean;
  run: (args: any, api: Api) => Promise<ToolOutput>;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export async function runTool<Api>(tool: ToolDef<Api>, args: unknown, api: Api): Promise<ToolResult> {
  try {
    const out = await tool.run(args, api);
    return { content: [{ type: "text", text: out.text }], structuredContent: out.structured };
  } catch (err) {
    // Pass the message through as it was written, so the caller can act on it.
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

export function registerTools<Api>(server: McpServer, tools: ToolDef<Api>[], api: Api): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: { readOnlyHint: tool.readOnly, destructiveHint: tool.destructive ?? false, openWorldHint: false },
      },
      async (args: unknown) => runTool(tool, args, api),
    );
  }
}

export function bullets(lines: string[], empty = "Nothing to show."): string {
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : empty;
}
