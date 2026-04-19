#!/usr/bin/env node
/**
 * Copies the dashboard UI into public/ for Vercel static hosting.
 * Run via: npm run build
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const src = path.join(root, "lib", "dashboard-ui.html");
const pub = path.join(root, "public");
const dest = path.join(pub, "index.html");

if (!fs.existsSync(src)) {
  console.error("build.js: missing", src);
  process.exit(1);
}

fs.mkdirSync(pub, { recursive: true });
fs.copyFileSync(src, dest);
console.log("build.js →", path.relative(root, dest));
