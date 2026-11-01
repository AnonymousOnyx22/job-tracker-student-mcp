import { describe, it, expect, beforeAll } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { tools } from "../src/tools.js";
import { tempStore } from "./helpers.js";

let client: Client;
beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(tempStore()).connect(a);
  client = new Client({ name: "structured output test", version: "0.0.0" });
  await client.connect(b);
});

/** Calls a tool through the MCP client and returns the whole result. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const r: any = await client.callTool({ name, arguments: args });
  return { text: r.content[0].text as string, structured: r.structuredContent as Record<string, any> | undefined, isError: !!r.isError };
}

describe("the server over a real MCP client", () => {
  it("lists the eight tools with an output schema and the right read only hints", async () => {
    const listed = (await client.listTools()).tools;
    expect(listed.map((t) => t.name)).toEqual(["add_application", "import_applications", "update_status", "update_application", "delete_application", "list_applications", "list_upcoming", "export_report"]);
    for (const tool of listed) {
      expect(tool.outputSchema, `${tool.name} output schema`).toBeTruthy();
      const def = tools.find((t) => t.name === tool.name)!;
      expect(tool.annotations?.readOnlyHint, `${tool.name} read only hint`).toBe(def.readOnly);
      expect(tool.annotations?.destructiveHint, `${tool.name} destructive hint`).toBe(tool.name === "delete_application");
    }
  });

  it("runs add, update, list and export in one session and every result fits its schema", async () => {
    const added = await call("add_application", { company: "Shopify", role: "Software Intern", deadline: "2026-11-15", source: "LinkedIn" });
    expect(added.isError).toBe(false);
    const id = added.structured!.application.id as number;

    const updated = await call("update_status", { id, status: "interview", interview_date: "2026-11-20T14:30" });
    expect(updated.structured!.previous_status).toBe("applied");

    const upcoming = await call("list_upcoming", { today: "2026-11-18" });
    expect(upcoming.structured!.items).toHaveLength(1);
    expect(upcoming.structured!.items[0]).toMatchObject({ kind: "interview", days_left: 2 });

    const report = await call("export_report", { format: "csv" });
    expect(report.structured!.count).toBe(1);
    expect(report.text).toContain("Shopify");

    const results = { add_application: added, update_status: updated, list_upcoming: upcoming, export_report: report };
    for (const [name, result] of Object.entries(results)) {
      const schema = z.object(tools.find((t) => t.name === name)!.outputSchema!);
      expect(schema.safeParse(result.structured).success, `${name} fields`).toBe(true);
    }
  });

  it("returns an error result, not a crash, for a bad call", async () => {
    const r = await call("update_status", { id: 404, status: "offer" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("There is no application with id 404");
  });
});
