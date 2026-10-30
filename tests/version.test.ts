import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VERSION } from "../src/server.js";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

describe("version drift", () => {
  it("package.json, server.json and the code give the same version", () => {
    const pkg = readJson("package.json");
    const server = readJson("server.json");
    expect(server.version, "server.json version").toBe(pkg.version);
    expect(server.packages[0].version, "server.json packages[0].version").toBe(pkg.version);
    expect(VERSION, "VERSION in src/server.ts").toBe(pkg.version);
  });

  it("has a CHANGELOG.md section for the current version", () => {
    const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    expect(changelog).toContain(`## ${readJson("package.json").version}`);
  });
});
