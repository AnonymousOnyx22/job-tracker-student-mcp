import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { tools } from "../src/tools.js";

const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const CLAIM = "Works offline, no account.";

/** The text of one tool section of llms.txt, from its heading to the next heading. */
function llmsSection(name: string): string {
  const start = llms.indexOf(`### ${name}\n`);
  if (start === -1) throw new Error(`llms.txt has no section for ${name}`);
  const end = llms.indexOf("\n#", start + 1);
  return llms.slice(start, end === -1 ? undefined : end);
}

/** The names of the tool headings under "## Tools", in file order. */
function llmsToolNames(): string[] {
  const section = llms.slice(llms.indexOf("## Tools"), llms.indexOf("## FAQ"));
  return [...section.matchAll(/^### (\w+)$/gm)].map((m) => m[1]);
}

function promptOf(description: string): string {
  const prompt = /Example prompt: "([^"]+)"\s*$/.exec(description)?.[1];
  if (!prompt) throw new Error("no example prompt at the end of the description");
  return prompt;
}

/** The field names of a JSON schema, including the ones inside arrays. */
function schemaFields(schema: unknown, names: string[] = []): string[] {
  const s = schema as { properties?: Record<string, unknown> };
  for (const [key, def] of Object.entries(s?.properties ?? {})) {
    names.push(key);
    const field = def as { items?: unknown };
    if (field.items) schemaFields(field.items, names);
  }
  return names;
}

describe("llms.txt", () => {
  it("lists every tool once and in the same order as src/tools.ts", () => {
    expect(llmsToolNames()).toEqual(tools.map((t) => t.name));
  });

  it("uses the tool descriptions from src/tools.ts", () => {
    for (const tool of tools) {
      expect(llmsSection(tool.name).split("\n")[1], `description of ${tool.name}`).toBe(tool.description);
    }
  });

  it("names the parameters of every tool in order and describes each one", () => {
    for (const tool of tools) {
      const section = llmsSection(tool.name);
      const props = Object.keys(tool.inputSchema);
      expect(/^Parameters: (.*)\.$/m.exec(section)?.[1], `${tool.name} parameters line`).toBe(props.join(", "));
      for (const p of props) {
        const schema = z.toJSONSchema(tool.inputSchema[p], { io: "input" }) as { description?: string };
        expect(section, `${tool.name}.${p}`).toContain(`- ${p}: ${schema.description}`);
      }
    }
  });

  it("gives every tool an example call that its own schema accepts", () => {
    for (const tool of tools) {
      const text = /^Example call: `(.*)`$/m.exec(llmsSection(tool.name))?.[1];
      expect(text, `example call for ${tool.name}`).toBeTruthy();
      const call = JSON.parse(text!) as { name: string; arguments: Record<string, unknown> };
      expect(call.name).toBe(tool.name);
      expect(z.object(tool.inputSchema).safeParse(call.arguments).success, `${tool.name} example`).toBe(true);
    }
  });

  it("names every field of the output schema of every tool", () => {
    for (const tool of tools) {
      const line = /^Structured output: (.*)$/m.exec(llmsSection(tool.name))?.[1] ?? "";
      const fields = schemaFields(z.toJSONSchema(z.object(tool.outputSchema!), { io: "output" }));
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) expect(line, `${tool.name} structured output`).toContain(field);
    }
  });

  it("keeps the offline and no account claim word for word", () => {
    expect(llms).toContain(CLAIM);
  });
});

describe("the README", () => {
  it("has a table row for every tool, in order, with the example prompt of the tool", () => {
    const rows = readme.split("\n").filter((line) => line.startsWith("| `"));
    expect(rows.map((r) => /^\| `(\w+)`/.exec(r)![1])).toEqual(tools.map((t) => t.name));
    for (const tool of tools) {
      const row = rows.find((r) => r.startsWith(`| \`${tool.name}\` |`))!;
      expect(row.trimEnd().endsWith(`| "${promptOf(tool.description)}" |`), `${tool.name} prompt`).toBe(true);
      const params = Object.keys(tool.inputSchema).map((p) => `\`${p}\``).join(", ");
      expect(row, `${tool.name} parameters`).toContain(`| ${params} |`);
    }
  });

  it("uses example prompts of the tools for its three headline prompts", () => {
    const start = readme.indexOf("## Try these three prompts");
    const end = readme.indexOf("More things you can ask", start);
    const quoted = [...readme.slice(start, end).matchAll(/^\s*>\s*"(.*)"$/gm)].map((m) => m[1]);
    expect(quoted).toHaveLength(3);
    const known = tools.map((t) => promptOf(t.description));
    for (const prompt of quoted) expect(known, prompt).toContain(prompt);
  });

  it("has the sections the other servers have", () => {
    for (const heading of ["## Install", "## Try these three prompts", "## Tools", "## Privacy", "## Troubleshooting", "## Node version", "## Development", "## License"]) {
      expect(readme, heading).toContain(`\n${heading}\n`);
    }
  });

  it("says how many tools there are", () => {
    expect(readme).toContain("There are six tools.");
    expect(tools).toHaveLength(6);
  });
});

describe("the wording of the docs", () => {
  const files = { "README.md": readme, "llms.txt": llms, "CHANGELOG.md": readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8") };

  it("has no em dashes or en dashes", () => {
    for (const [name, text] of Object.entries(files)) expect(text, name).not.toMatch(/[–—]/);
  });

  it("does not mention ChatGPT or leftovers of the old project", () => {
    for (const [name, text] of Object.entries(files)) expect(text.replace(/\n## More free student MCP servers[\s\S]*?(?=\n## |$)/, ""), name).not.toMatch(/chatgpt|openai|codex|gpa/i); // the sibling servers table names the other servers on purpose
  });

  it("names only apps that run a local MCP server", () => {
    expect(readme).toContain("Claude Desktop, Claude Code, Cursor, VS Code and Windsurf");
  });
});
