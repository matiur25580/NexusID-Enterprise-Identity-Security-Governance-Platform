import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const pattern = /!\[[^\]]*\]\((https:\/\/raw\.githubusercontent\.com\/matiur25580\/NexusID-Enterprise-Identity-Security-Governance-Platform\/main\/docs\/images\/(dashboard-\d{2}-[a-z0-9-]+\.svg))\)/g;
const matches = [...readme.matchAll(pattern)];
assert.equal(matches.length, 12, `Expected exactly 12 direct README dashboard image links; found ${matches.length}.`);

const names = new Set();
for (const match of matches) {
  const file = match[2];
  assert.ok(!names.has(file), `Duplicate dashboard image reference: ${file}`);
  names.add(file);
  const path = resolve(root, "docs/images", file);
  assert.ok(existsSync(path), `README image target does not exist: ${path}`);
  const svg = readFileSync(path, "utf8");
  assert.match(svg, /^<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${file} is not an SVG document`);
  assert.match(svg, /<\/svg>\s*$/, `${file} has no closing SVG element`);
}
console.log(`README dashboard gallery OK: ${matches.length} unique image files exist and contain SVG roots.`);
