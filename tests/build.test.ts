import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

/** Checks a locked version against a caret range such as "^1.2.3". */
function inCaretRange(version: string, range: string): boolean {
  const [vMajor, vMinor, vPatch] = version.split(".").map(Number);
  const [bMajor, bMinor, bPatch] = range.replace(/^\^/, "").split(".").map(Number);
  if (vMajor !== bMajor) return false;
  if (vMinor !== bMinor) return vMinor > bMinor;
  return vPatch >= bPatch;
}

describe("the compiler setup", () => {
  it("names the node types so the node globals are found", () => {
    expect(readJson("tsconfig.json").compilerOptions.types, "tsconfig.json types").toContain("node");
  });
});

describe("package-lock.json", () => {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  const root = lock.packages[""];

  it("is for this package", () => {
    expect(lock.name).toBe("job-application-tracker-mcp");
    expect(lock.version).toBe(pkg.version);
  });

  it("locks the same ranges as package.json", () => {
    expect(root.dependencies, "locked dependencies").toEqual(pkg.dependencies);
    expect(root.devDependencies, "locked dev dependencies").toEqual(pkg.devDependencies);
  });

  it("locks a version inside the range of every dependency", () => {
    const ranges = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, range] of Object.entries(ranges)) {
      const locked = lock.packages[`node_modules/${name}`]?.version;
      expect(locked, `locked version of ${name}`).toBeTruthy();
      expect(inCaretRange(locked, range as string), `${name}@${locked} inside ${range}`).toBe(true);
    }
  });
});
