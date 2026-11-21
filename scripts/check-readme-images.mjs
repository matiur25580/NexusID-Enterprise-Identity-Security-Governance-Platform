import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const pattern = /!\[[^\]]*\]\((?:https:\/\/raw\.githubusercontent\.com\/matiur25580\/NexusID-Enterprise-Identity-Security-Governance-Platform\/main\/docs\/images\/|docs\/images\/)(dashboard-\d{2}-[a-z0-9-]+\.png)\)/g;
const matches = [...readme.matchAll(pattern)];
assert.equal(matches.length, 12, `Expected exactly 12 direct README dashboard image links; found ${matches.length}.`);
const names = new Set();
for (const match of matches) {
  const file = match[1];
  assert.ok(!names.has(file), `Duplicate dashboard image reference: ${file}`);
  names.add(file);
  const path = resolve(root, "docs/images", file);
  assert.ok(existsSync(path), `README image target does not exist: ${path}`);
  const png = readFileSync(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} is not a PNG image`);
  assert.equal(png.readUInt32BE(16), 1200, `${file} width must be 1200px`);
  assert.equal(png.readUInt32BE(20), 700, `${file} height must be 700px`);
}
console.log(`README dashboard gallery OK: ${matches.length} unique 1200x700 PNG files exist.`);
