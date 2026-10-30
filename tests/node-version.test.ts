import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const readText = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pkg = readJson("package.json");
const readme = readText("README.md");

/** The package.json of an installed package, read from the flat node_modules folder. */
function installedPackage(name: string): { version?: string; engines?: { node?: string } } {
  return readJson(`node_modules/${name}/package.json`);
}

/** Compares two dotted versions, part by part. Missing parts count as zero. */
function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Pads a dotted version out to three parts, so two versions can be compared as text. */
function normalize(version: string): string {
  const parts = version.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0].join(".");
}

/** The lowest node version an engine range allows, as a dotted version. */
function lowestIn(range: string): string {
  const floors = range
    .split("||")
    .map((part) => /(\d+(?:\.\d+)*)/.exec(part)?.[1] ?? "0")
    .sort(compareVersions);
  return floors[0];
}

/** The cell of a markdown table row, found by the label in the first column. */
function tableCell(label: string): string {
  const row = readme.split("\n").find((line) => line.trim().startsWith(`| ${label}`));
  if (!row) throw new Error(`README.md has no table row that starts with ${label}`);
  const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
  return cells[1] ?? "";
}

/** The first version number a piece of text names. */
function firstVersion(text: string): string {
  const found = /(\d+(?:\.\d+)*)/.exec(text);
  if (!found) throw new Error(`no version number in ${text}`);
  return found[1];
}

const runtimeRange = (pkg.engines?.node ?? "") as string;
const devRange = (pkg.devEngines?.runtime?.version ?? "") as string;
const runtimeFloor = normalize(lowestIn(runtimeRange));
const devFloor = normalize(lowestIn(devRange));

describe("the node runtime floor", () => {
  it("is stated in package.json for people who install the server", () => {
    expect(runtimeRange, "the runtime range").toMatch(/^>=\d+(\.\d+)*$/);
    expect(runtimeFloor, "the runtime floor").toBe("20.0.0");
  });

  it("is the same number in the README", () => {
    expect(normalize(firstVersion(tableCell("Running the published server")))).toBe(runtimeFloor);
  });

  it("is a node version every runtime dependency accepts", () => {
    for (const name of Object.keys(pkg.dependencies as Record<string, string>)) {
      const engines = installedPackage(name).engines?.node;
      if (!engines) continue;
      expect(compareVersions(runtimeFloor, normalize(lowestIn(engines))), `${name} asks for node ${engines}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("builds to a language level the runtime floor understands", () => {
    const target = readJson("tsconfig.json").compilerOptions.target as string;
    const year = Number(/ES(\d{4})/.exec(target)?.[1] ?? "0");
    expect(year, `the build target ${target}`).toBeGreaterThan(0);
    expect(year, `the build target ${target}`).toBeLessThanOrEqual(2022);
  });
});

describe("the node development floor", () => {
  it("is stated in package.json for people who clone the repo", () => {
    expect(pkg.devEngines?.runtime?.name, "the devEngines runtime name").toBe("node");
    expect(devFloor, "the development floor").toBe("22.12.0");
  });

  it("is the same number in the README and names every release line", () => {
    const cell = tableCell("Building and testing a clone");
    expect(normalize(firstVersion(cell))).toBe(devFloor);
    const majors = [...new Set(devRange.split("||").map((part) => /(\d+)/.exec(part)?.[1]).filter(Boolean))];
    for (const major of majors) expect(cell, `the README mentions node ${major}`).toMatch(new RegExp(`(?<!\\d)${major}(?!\\d)`));
  });

  it("matches the range the test runner asks for", () => {
    expect(devRange, "the development range").toBe(installedPackage("vitest").engines?.node);
  });

  it("sits above the runtime floor", () => {
    expect(compareVersions(devFloor, runtimeFloor)).toBeGreaterThan(0);
  });
});

describe("the README points at the one place that holds both floors", () => {
  it("names engines and devEngines from package.json", () => {
    expect(readme).toContain("`engines`");
    expect(readme).toContain("`devEngines`");
    expect(readme).toContain("package.json");
  });

  it("says that npm checks devEngines before install, run and test", () => {
    expect(readme).toContain("before install, run and test");
  });
});
