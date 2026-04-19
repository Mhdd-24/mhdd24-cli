#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline-sync");

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

// -----------------------------
// Helpers
// -----------------------------
function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

function getBranch() {
  return execSync("git branch --show-current").toString().trim();
}

// -----------------------------
// CLI Commands
// -----------------------------
switch (command) {

  // 🔹 PUSH
  case "push":
    if (!arg1) {
      console.log("❌ Provide commit message");
      process.exit(1);
    }
    run("git add .");
    run(`git commit -m "${arg1}"`);
    run(`git push origin ${getBranch()}`);
    break;

  // 🔹 DEPLOY
  case "deploy":
    if (!arg1) {
      console.log("❌ Provide commit message");
      process.exit(1);
    }
    run("git add .");
    run(`git commit -m "${arg1}"`);
    run(`git push origin ${getBranch()}`);
    run("npm run build");
    run("npm run deploy");
    console.log("✅ Deployed!");
    break;

  // 🔹 SEED
  case "seed":
    const root = process.cwd();
    const seedPath = path.join(root, "api/Mhdd24.Api/SeedData/collections");
    const scriptPath = path.join(root, "api/Mhdd24.Api/SeedData/seed-collections.mongosh.js");

    if (!fs.existsSync(seedPath)) {
      console.log("❌ Not a valid project (SeedData not found)");
      process.exit(1);
    }

    if (!process.env.MONGO_URI) {
      console.log("❌ Set MONGO_URI first");
      process.exit(1);
    }

    ["en", "de", "ta", "ml"].forEach((lang) => {
      console.log(`🌱 Seeding ${lang}`);
      run(`MONGODB_SEED_COLLECTIONS_ROOT="${seedPath}" MONGODB_SEED_LOCALE=${lang} mongosh "${process.env.MONGO_URI}" --file "${scriptPath}"`);
    });

    console.log("✅ DB Seed Done");
    break;

  // 🔹 STATUS
  case "status":
    console.log(`🌿 Branch: ${getBranch()}`);
    run("git status -s");
    break;

  // 🔹 PULL
  case "pull":
    run(`git pull origin ${getBranch()}`);
    break;

  // 🔹 NEW BRANCH
  case "branch":
    if (!arg1) {
      console.log("❌ Provide branch name");
      process.exit(1);
    }
    run(`git checkout -b ${arg1}`);
    break;

  // 🔹 SWITCH
  case "switch":
    if (!arg1) {
      console.log("❌ Provide branch name");
      process.exit(1);
    }
    run(`git checkout ${arg1}`);
    break;

  // 🔹 CLEAN INSTALL
  case "clean":
    run("rm -rf node_modules package-lock.json");
    run("npm install");
    console.log("✅ Clean install done");
    break;

  // 🔹 BUILD
  case "build":
    run("npm run build");
    break;

  // 🔹 DEPLOY ONLY
  case "deploy-only":
    run("npm run deploy");
    break;

  // 🔹 OPEN PROJECT
  case "open":
    run("code .");
    break;

  // 🔹 RELEASE (🔥 PRO FEATURE)
  case "release":
    const versionType = arg1 || "patch";
    const message = arg2 || "release";

    console.log("🚀 Starting release...");

    // Check git clean
    const status = execSync("git status --porcelain").toString();
    if (status) {
      console.log("❌ Git working directory not clean. Commit changes first.");
      process.exit(1);
    }

    // Step 1: Version bump
    console.log("📦 Bumping version...");
    run(`npm version ${versionType} -m "🔖 v%s - ${message}"`);

    // Step 2: Push code
    const branch = getBranch();
    run(`git push origin ${branch}`);

    // Step 3: Push tags
    run("git push origin --tags");

    // Step 4: Publish
    console.log("📤 Publishing to npm...");
    const otp = readline.question("Enter OTP: ");
    run(`npm publish --otp=${otp}`);

    console.log("✅ Release completed!");
    break;

  // 🔹 HELP
  default:
    console.log(`
🚀 mhdd24 CLI

Commands:
  mhdd24 push "msg"
  mhdd24 deploy "msg"
  mhdd24 seed
  mhdd24 status
  mhdd24 pull
  mhdd24 branch <name>
  mhdd24 switch <name>
  mhdd24 clean
  mhdd24 build
  mhdd24 deploy-only
  mhdd24 open
  mhdd24 release [patch|minor|major] "msg"
`);
}