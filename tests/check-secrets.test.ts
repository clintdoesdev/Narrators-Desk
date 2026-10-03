import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(__dirname, "..", "scripts", "check-secrets.mjs");
let dir = "";

function run(contents: string) {
  dir = mkdtempSync(join(tmpdir(), "nd-secrets-"));
  mkdirSync(join(dir, ".next", "static", "chunks"), { recursive: true });
  writeFileSync(join(dir, ".next", "static", "chunks", "app.js"), contents);
  return spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "test" } });
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("check-secrets build guard", () => {
  it("passes a clean bundle", () => {
    expect(run("console.log('hello')").status).toBe(0);
  });

  it("fails when ELEVENLABS appears in client code", () => {
    const r = run("const k = process.env.ELEVENLABS_API_KEY;");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ELEVENLABS/);
  });

  it("fails when the xi-api-key header appears in client code", () => {
    expect(run("fetch(u,{headers:{'xi-api-key':k}})").status).toBe(1);
  });
});
