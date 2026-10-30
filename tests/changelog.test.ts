import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

/** The version headings of CHANGELOG.md, in file order. */
function headings(): string[] {
  return [...changelog.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
}

/** The bullet items of one version section. */
function items(version: string): string[] {
  const start = changelog.indexOf(`## ${version}`);
  if (start === -1) throw new Error(`CHANGELOG.md has no ## ${version} section`);
  const rest = changelog.slice(start + `## ${version}`.length);
  const next = rest.indexOf("\n## ");
  return (next === -1 ? rest : rest.slice(0, next))
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

describe("the top of CHANGELOG.md", () => {
  it("puts Unreleased first when there is one", () => {
    if (headings().includes("Unreleased")) expect(headings()[0]).toBe("Unreleased");
  });

  it("lists at least one change in the newest section", () => {
    expect(items(headings()[0]).length, "changes in the newest section").toBeGreaterThan(0);
  });

  it("has a real change on every bullet line", () => {
    for (const item of items(headings()[0])) expect(item.length, `a bullet: ${item}`).toBeGreaterThan(10);
  });
});
