#!/usr/bin/env node
// Fails the build if anything secret-looking ended up in client bundles.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) {
  console.error("check-secrets: .next/static not found. Run `next build` first.");
  process.exit(1);
}

const needles = ["ELEVENLABS", "xi-api-key", "SESSION_SECRET", "APP_PASSWORD", "VOICE_ID"];
// Also catch the literal values if they're present in this environment.
for (const name of ["ELEVENLABS_API_KEY", "VOICE_ID", "APP_PASSWORD", "SESSION_SECRET"]) {
  const v = process.env[name];
  if (v && v.length >= 8) needles.push(v);
}

const hits = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(entry)) {
      const text = readFileSync(p, "utf8");
      for (const n of needles) if (text.includes(n)) hits.push(`${p}: contains ${n.length > 20 ? "a secret value" : n}`);
    }
  }
}
walk(root);

if (hits.length) {
  console.error("check-secrets: FAILED — secrets found in client bundle:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("check-secrets: OK — no secrets in .next/static");
