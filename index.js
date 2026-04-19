#!/usr/bin/env node

const { execSync } = require("child_process");

const command = process.argv[2];
const message = process.argv[3];

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Error:", e.message);
  }
}

switch (command) {
  case "push":
    if (!message) {
      console.log("❌ Provide commit message");
      process.exit(1);
    }
    run("git add .");
    run(`git commit -m "${message}"`);
    run(`git push origin $(git branch --show-current)`);
    break;

  case "deploy":
    if (!message) {
      console.log("❌ Provide commit message");
      process.exit(1);
    }
    run("git add .");
    run(`git commit -m "${message}"`);
    run(`git push origin $(git branch --show-current)`);
    run("npm run build");
    run("npm run deploy");
    console.log("✅ Deployed!");
    break;

    case "seed":
    const path = require("path");

    const root = process.cwd();
    const seedPath = path.join(root, "api/Mhdd24.Api/SeedData/collections");
    const scriptPath = path.join(root, "api/Mhdd24.Api/SeedData/seed-collections.mongosh.js");

    if (!process.env.MONGO_URI) {
        console.log("❌ Set MONGO_URI first");
        process.exit(1);
    }

    ["en", "de", "ta", "ml"].forEach((lang) => {
        console.log(`🌱 Seeding ${lang}`);
        run(`MONGODB_SEED_COLLECTIONS_ROOT="${seedPath}" MONGODB_SEED_LOCALE=${lang} mongosh "${process.env.MONGO_URI}" --file "${scriptPath}"`);
    });
    break;

  default:
    console.log(`
mhdd CLI

Commands:
  mhdd24 push "msg"
  mhdd24 deploy "msg"
  mhdd24 seed
`);
}