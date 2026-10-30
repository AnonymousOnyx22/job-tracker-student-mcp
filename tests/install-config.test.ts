import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { name: string };

const PACKAGE = "job-tracker-student-mcp";
const SERVER = "job-tracker";

/** The apps the README gives an install config for. */
const APPS = ["Claude Desktop", "Claude Code", "Cursor", "VS Code", "Windsurf"];

/** The README from the Install heading down to the next heading of the same level. */
function installSection(): string {
  const start = readme.indexOf("## Install");
  if (start === -1) throw new Error("README.md has no Install section");
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end === -1 ? readme.length : end);
}

/** The part of the install section under one heading, up to the next heading. */
function part(heading: string): string {
  const lines = installSection().split("\n");
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start === -1) throw new Error(`README.md has no ${heading} part in the install section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("### "));
  return rest.slice(0, end === -1 ? rest.length : end).join("\n");
}

/** The fenced code blocks of one language in a piece of text. */
function blocks(text: string, language: string): string[] {
  const pattern = new RegExp("```" + language + "\\r?\\n([\\s\\S]*?)```", "g");
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

/** The GitHub anchor of a heading. */
function anchor(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-");
}

/** The server entry inside a config file, with the key the file uses for it. */
function serverIn(config: string): { key: string; entry: { command?: string; args?: string[] } } {
  const parsed = JSON.parse(config) as Record<string, Record<string, { command?: string; args?: string[] }>>;
  const key = Object.keys(parsed)[0];
  return { key, entry: parsed[key][SERVER] };
}

describe("the install section of the README", () => {
  it("has a part for every app and links it from the list", () => {
    const lines = installSection().split("\n").map((line) => line.trim());
    for (const app of APPS) {
      expect(lines, `a ${app} part`).toContain(`### ${app}`);
      expect(lines, `a link to ${app}`).toContain(`- [${app}](#${anchor(app)})`);
    }
  });

  it("names the package that is on npm", () => {
    expect(pkg.name).toBe(PACKAGE);
    expect(installSection()).toContain(`npx -y ${PACKAGE}`);
  });

  it("starts the same server with npx in every JSON config", () => {
    const configs = APPS.flatMap((app) => blocks(part(app), "json"));
    expect(configs.length, "the number of JSON configs").toBe(4);
    for (const config of configs) {
      const { entry } = serverIn(config);
      expect(entry, `the ${SERVER} server in a config`).toBeTruthy();
      expect(entry.command).toBe("npx");
      expect(entry.args).toEqual(["-y", PACKAGE]);
    }
  });

  it("uses the key each app reads", () => {
    expect(serverIn(blocks(part("Claude Desktop"), "json")[0]).key).toBe("mcpServers");
    expect(serverIn(blocks(part("Cursor"), "json")[0]).key).toBe("mcpServers");
    expect(serverIn(blocks(part("VS Code"), "json")[0]).key).toBe("servers");
    expect(serverIn(blocks(part("Windsurf"), "json")[0]).key).toBe("mcpServers");
  });

  it("says where each config goes", () => {
    expect(part("Claude Desktop")).toContain("claude_desktop_config.json");
    expect(part("Claude Code")).toContain(`claude mcp add ${SERVER} -- npx -y ${PACKAGE}`);
    expect(part("Cursor")).toContain(".cursor/mcp.json");
    expect(part("VS Code")).toContain(".vscode/mcp.json");
    expect(part("Windsurf")).toContain("mcp_config.json");
  });
});
