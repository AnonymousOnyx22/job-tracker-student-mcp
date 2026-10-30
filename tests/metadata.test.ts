import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const pkg = readJson("package.json");
const server = readJson("server.json");

const PHRASE = "job application tracker mcp";

describe("package metadata", () => {
  it("uses the exact name, version, bin and mcpName", () => {
    expect(pkg.name).toBe("job-tracker-student-mcp");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(server.version).toBe(pkg.version);
    expect(pkg.bin).toEqual({ "job-tracker-student-mcp": "build/src/index.js" });
    expect(pkg.mcpName).toBe("io.github.AnonymousOnyx22/job-tracker-student-mcp");
  });

  it("leads the description and keywords with the phrase job application tracker mcp", () => {
    expect(pkg.description.toLowerCase()).toContain(PHRASE);
    expect(pkg.keywords[0].toLowerCase()).toBe(PHRASE);
  });

  it("has at least ten keywords with no repeats", () => {
    expect(pkg.keywords.length).toBeGreaterThanOrEqual(10);
    expect(new Set(pkg.keywords).size).toBe(pkg.keywords.length);
  });

  it("keeps the search terms people type in the keywords", () => {
    for (const term of ["job tracker", "internship tracker", "interview tracker", "deadline reminders"]) {
      expect(pkg.keywords, `a keyword for ${term}`).toContain(term);
    }
  });

  it("keeps the server.json name and description on phrase and under the registry limit", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(server.packages[0].identifier).toBe(pkg.name);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description.toLowerCase()).toContain(PHRASE);
  });

  it("asks for no keys, passwords or environment variables to run", () => {
    expect(server.packages[0].environmentVariables).toBeUndefined();
    expect(pkg.dependencies).toEqual({ "@modelcontextprotocol/sdk": expect.any(String), zod: expect.any(String) });
  });
});
