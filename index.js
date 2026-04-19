#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline-sync");
const { detectFramework } = require("./lib/detect-framework");
const { startDashboard } = require("./lib/dashboard");

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

function readMhddRc() {
  const p = path.join(process.cwd(), ".mhdd24rc");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function writeMhddRc(data) {
  fs.writeFileSync(path.join(process.cwd(), ".mhdd24rc"), JSON.stringify(data, null, 2));
}

function ensureInGitRepo() {
  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
  } catch {
    console.log("❌ Not a git repository (run from repo root)");
    process.exit(1);
  }
}

function hasCmd(name) {
  try {
    execSync(`command -v ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getCmdPath(name) {
  try {
    return execSync(`command -v ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .trim()
      .split("\n")[0];
  } catch {
    return null;
  }
}

/** Commit subjects since last git tag, or last N commits if no tag. */
function gitLogSubjectsSinceLastTag(cwd, fallbackCount = 30) {
  const opt = { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  let range;
  try {
    const tag = execSync("git describe --tags --abbrev=0", opt).trim();
    range = `${tag}..HEAD`;
  } catch {
    range = `-${fallbackCount}`;
  }
  try {
    const out = execSync(`git log ${range} --pretty=%s`, opt).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

/**
 * Conventional-commit style guess: feat → minor, BREAKING / type! → major, else patch.
 */
function inferSemverBump(cwd) {
  const subjects = gitLogSubjectsSinceLastTag(cwd);
  if (!subjects.length) return "patch";
  for (const s of subjects) {
    if (/BREAKING CHANGE/i.test(s)) return "major";
  }
  for (const s of subjects) {
    if (/^(\w[\w-]*)(?:\([^)]*\))?!:/i.test(s)) return "major";
  }
  for (const s of subjects) {
    if (/^feat(?:\([^)]*\))?:/i.test(s)) return "minor";
  }
  return "patch";
}

function githubRepoToHttps(nameWithOwner) {
  return `https://github.com/${nameWithOwner.trim()}.git`;
}

function listGhRepos(limit = 40) {
  try {
    const out = execSync(`gh repo list --limit ${limit} --json nameWithOwner`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out).map((r) => r.nameWithOwner);
  } catch {
    return null;
  }
}

function pickGithubRepoInteractive() {
  const repos = listGhRepos();
  if (repos && repos.length > 0) {
    console.log("\nGitHub repositories (gh):");
    repos.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    const pick = readline.question("\nPick number (or paste owner/repo): ").trim();
    const n = parseInt(pick, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= repos.length) return repos[n - 1];
    if (/^[\w.-]+\/[\w.-]+$/.test(pick)) return pick;
    console.log("❌ Invalid choice");
    process.exit(1);
  }

  if (repos && repos.length === 0) {
    console.log("\n⚠️ gh returned no repositories.");
  } else {
    console.log("\n⚠️ gh not available or failed. Install: https://cli.github.com/");
  }
  const manual = readline.question("Enter GitHub repo as owner/repo: ").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(manual)) {
    console.log("❌ Expected format: owner/repo");
    process.exit(1);
  }
  return manual;
}

function defaultRcTemplate() {
  const fw = fs.existsSync(path.join(process.cwd(), "package.json"))
    ? detectFramework(process.cwd())
    : null;
  return {
    build: (fw && fw.buildCommand) || "npm run build",
    deploy: "npm run deploy",
    framework: fw
      ? {
          id: fw.id,
          label: fw.label,
          packageManager: fw.packageManager,
          buildCommand: fw.buildCommand,
          devCommand: fw.devCommand,
          detectedAt: new Date().toISOString()
        }
      : {},
    vercel: {
      project: "",
      githubRepo: "",
      domains: [],
      cliDeployAfterPush: false
    }
  };
}

function vercelProdIfRcEnabled() {
  const rc = readMhddRc();
  const v = rc.vercel || {};
  if (v.cliDeployAfterPush === true) {
    if (!hasCmd("vercel")) {
      console.log("⚠️ vercel CLI not found; skip post-push deploy (brew install vercel-cli)");
      return;
    }
    console.log("▲ Vercel production deploy (cliDeployAfterPush)...");
    run("vercel deploy --prod --yes");
  }
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
    vercelProdIfRcEnabled();
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
    vercelProdIfRcEnabled();
    {
      const rcDeploy = readMhddRc();
      run(rcDeploy.build || "npm run build");
      run(rcDeploy.deploy || "npm run deploy");
    }
    console.log("✅ Deployed!");
    break;

  // 🔹 SEED (multi-lang support)
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

    const langs = arg1 ? arg1.split(",") : ["en", "de", "ta", "ml"];

    langs.forEach((lang) => {
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
  case "build": {
    const rcBuild = readMhddRc();
    run(rcBuild.build || "npm run build");
    break;
  }

  // 🔹 DEPLOY ONLY
  case "deploy-only": {
    const rcOnly = readMhddRc();
    run(rcOnly.deploy || "npm run deploy");
    break;
  }

  // 🔹 OPEN PROJECT
  case "open":
    run("code .");
    break;

  // 🔹 DOCTOR (NEW)
  case "doctor":
    console.log("🩺 Running system check...\n");

    try {
      console.log("Node:", execSync("node -v").toString().trim());
      const nodePath = getCmdPath("node");
      if (nodePath) console.log("  Path:", nodePath);
      console.log("NPM:", execSync("npm -v").toString().trim());
      const npmPath = getCmdPath("npm");
      if (npmPath) console.log("  Path:", npmPath);
      console.log("Git:", execSync("git --version").toString().trim());
    } catch {
      console.log("❌ Some tools are missing");
    }

    if (!process.env.MONGO_URI) {
      console.log("⚠️ MONGO_URI not set");
    } else {
      console.log("✅ MONGO_URI OK");
    }

    if (fs.existsSync(path.join(process.cwd(), "package.json"))) {
      const fw = detectFramework();
      console.log(`\n📦 Framework: ${fw.label} (${fw.id})`);
      console.log(`   Package manager: ${fw.packageManager}`);
      console.log(`   Suggested build: ${fw.buildCommand}`);
    }

    console.log("\n✅ Doctor check complete");
    break;

  // 🔹 LOGS (NEW)
  case "logs":
    console.log("📜 Showing logs...");
    run("tail -f logs/app.log");
    break;

  // 🔹 ENV (NEW)
  case "env":
    if (!arg1 || !arg2) {
      console.log("Usage: mhdd24 env KEY VALUE");
      process.exit(1);
    }
    fs.appendFileSync(".env", `\n${arg1}=${arg2}`);
    console.log(`✅ Added ${arg1} to .env`);
    break;

  // 🔹 INIT (NEW)
  case "init":
    console.log("⚡ Initializing project...");

    fs.writeFileSync(".mhdd24rc", JSON.stringify(defaultRcTemplate(), null, 2));

    if (!fs.existsSync(".env")) {
      fs.writeFileSync(".env", "MONGO_URI=\n");
    }

    console.log("✅ Project initialized (framework auto-detected when package.json exists)");
    break;

  // 🔹 DETECT (framework + PM, write .mhdd24rc)
  case "detect": {
    const fw = detectFramework();
    console.log("\n📦 Detected stack\n");
    console.log(JSON.stringify(fw, null, 2));

    const prev = readMhddRc();
    writeMhddRc({
      ...prev,
      framework: {
        id: fw.id,
        label: fw.label,
        packageManager: fw.packageManager,
        buildCommand: fw.buildCommand,
        devCommand: fw.devCommand,
        detectedAt: new Date().toISOString()
      }
    });
    console.log("\n✅ Updated .mhdd24rc → framework");

    if (readline.keyInYNStrict("Set rc \"build\" to the suggested command? ")) {
      const p = readMhddRc();
      writeMhddRc({ ...p, build: fw.buildCommand });
      console.log(`✅ build → ${fw.buildCommand}`);
    }
    break;
  }

  // 🔹 DASHBOARD (local web panel)
  case "dashboard": {
    const port = arg1 ? parseInt(arg1, 10) : parseInt(process.env.MHDD_DASH_PORT || "3847", 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.log("❌ Invalid port. Example: mhdd24 dashboard 3847");
      process.exit(1);
    }
    startDashboard({ cwd: process.cwd(), port });
    process.stdin.resume();
    break;
  }

  // 🔹 DOMAIN ADD (Vercel — attach domain to project)
  case "domain-add": {
    if (!arg1) {
      console.log("Usage: mhdd24 domain-add <domain.example.com>");
      process.exit(1);
    }
    const domain = arg1.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      console.log("❌ Domain looks invalid");
      process.exit(1);
    }
    if (!hasCmd("vercel")) {
      console.log("❌ vercel CLI not found. Install: npm i -g vercel");
      process.exit(1);
    }
    const rcDom = readMhddRc();
    const vProj = rcDom.vercel && rcDom.vercel.project;
    if (vProj) {
      run(`vercel domains add "${domain}" "${vProj}" --yes`);
    } else {
      run(`vercel domains add "${domain}" --yes`);
    }
    const list = Array.from(new Set([...(rcDom.vercel && rcDom.vercel.domains) || [], domain]));
    writeMhddRc({
      ...rcDom,
      vercel: { ...(rcDom.vercel || {}), domains: list }
    });
    console.log("\n✅ Domain registered on Vercel for this project.");
    console.log("   Point DNS to Vercel (nameservers or records): https://vercel.com/docs/concepts/projects/domains");
    break;
  }

  // 🔹 ANALYZE (NEW)
  case "analyze":
    console.log("📊 Analyzing bundle...");
    run("npx source-map-explorer build/static/js/*.js");
    break;

  // 🔹 ROLLBACK (NEW)
  case "rollback":
    console.log("⏪ Rolling back last commit...");
    run("git reset --soft HEAD~1");
    break;

  // 🔹 SMART COMMIT (NEW)
  case "smart-commit":
    const changes = execSync("git status --porcelain").toString();

    let msg = "chore: update";

    if (changes.includes("feat")) msg = "feat: update";
    else if (changes.includes("fix")) msg = "fix: bug fixes";

    run("git add .");
    run(`git commit -m "${msg}"`);
    run(`git push origin ${getBranch()}`);
    vercelProdIfRcEnabled();

    console.log("✅ Smart commit done");
    break;

  // 🔹 CLEAN GIT (NEW)
  case "clean-git":
    run("git clean -fd");
    run("git reset --hard");
    console.log("🧹 Repo cleaned");
    break;

  // 🔹 VERCEL SETUP (link project + connect GitHub repo for auto deploy)
  case "vercel-setup":
    ensureInGitRepo();
    if (!hasCmd("vercel")) {
      console.log("❌ vercel CLI not found. Install: npm i -g vercel");
      process.exit(1);
    }

    const nameWithOwner = pickGithubRepoInteractive();
    const gitUrl = githubRepoToHttps(nameWithOwner);
    const defaultProject = nameWithOwner.includes("/")
      ? nameWithOwner.split("/")[1]
      : path.basename(process.cwd());
    const project = readline.question(`Vercel project name [${defaultProject}]: `).trim() || defaultProject;

    const syncOrigin = readline.keyInYNStrict(
      `Set git remote origin to ${gitUrl}? `
    );
    if (syncOrigin) {
      try {
        execSync("git remote get-url origin", { stdio: "ignore" });
        run(`git remote set-url origin "${gitUrl}"`);
      } catch {
        run(`git remote add origin "${gitUrl}"`);
      }
    }

    run(`vercel link --yes --project "${project}"`);
    run(`vercel git connect "${gitUrl}" --yes`);

    const cliAlso = readline.keyInYNStrict(
      "Also run `vercel deploy --prod` after every mhdd24 push/deploy? "
    );

    const prevRc = readMhddRc();
    writeMhddRc({
      ...prevRc,
      vercel: {
        ...(prevRc.vercel || {}),
        project,
        githubRepo: nameWithOwner,
        cliDeployAfterPush: cliAlso
      }
    });

    console.log("\n✅ Vercel linked and Git connected. Pushes to that repo trigger Vercel builds.");
    if (cliAlso) console.log("✅ cliDeployAfterPush enabled in .mhdd24rc");
    break;

  // 🔹 VERCEL (production deploy now)
  case "vercel":
    if (!hasCmd("vercel")) {
      console.log("❌ vercel CLI not found. Install: npm i -g vercel");
      process.exit(1);
    }
    run("vercel deploy --prod --yes");
    break;

  // 🔹 OPEN URL (NEW)
  case "open-url":
    if (!arg1) {
      console.log("❌ Provide URL");
      process.exit(1);
    }
    run(`open ${arg1}`);
    break;

  // 🔹 RELEASE (UPGRADED)
  case "release":
    console.log("🚀 Smart Release Starting...");

    const status = execSync("git status --porcelain").toString();
    if (status) {
      console.log("❌ Git working directory not clean. Commit changes first.");
      process.exit(1);
    }

    // Auto version + changelog
    run("npx standard-version");

    const branch = getBranch();

    // Push code
    run(`git push origin ${branch}`);

    // Push tags
    run("git push --follow-tags");

    // Publish
    console.log("📤 Publishing to npm...");
    const otp = readline.question("Enter OTP: ");
    run(`npm publish --otp=${otp}`);

    console.log("✅ Release completed!");
    break;

  // 🔹 VERSION (npm version — semver bump; auto = match commits → patch|minor|major)
  case "version": {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(pkgPath)) {
      console.log("❌ No package.json in this directory");
      process.exit(1);
    }
    ensureInGitRepo();
    const raw = (arg1 || "patch").toLowerCase();
    const noGitTag = process.argv.includes("--no-git-tag-version");
    const level = raw === "--no-git-tag-version" ? "patch" : raw;
    const valid = new Set(["patch", "minor", "major", "auto"]);
    if (!valid.has(level)) {
      console.log(`Usage: mhdd24 version [patch|minor|major|auto]

  patch (default)  — npm version patch
  minor / major    — npm version minor | major
  auto             — infer bump from conventional commits since last tag
                     (feat → minor, type! / BREAKING CHANGE → major, else patch)

  Append --no-git-tag-version to only edit package.json (no git commit/tag).`);
      process.exit(1);
    }
    let bump = level;
    if (level === "auto") {
      bump = inferSemverBump(process.cwd());
      console.log(`📌 Auto-matched semver bump: ${bump} (from git history)\n`);
    }
    const flags = noGitTag ? " --no-git-tag-version" : "";
    run(`npm version ${bump}${flags}`);
    console.log("\n✅ package.json version updated.");
    if (!noGitTag) console.log("   (npm also created a version commit + tag unless configured otherwise)");
    break;
  }

  // 🔹 HELP
  default:
    console.log(`
🚀 mhdd24 CLI

Core:
  mhdd24 push "msg"
  mhdd24 deploy "msg"
  mhdd24 release
  mhdd24 version [patch|minor|major|auto] [--no-git-tag-version]

Vercel:
  mhdd24 vercel-setup   (pick GitHub repo, link, git connect — auto deploy on push)
  mhdd24 vercel         (production deploy now)
  mhdd24 domain-add <domain>   (Vercel domain → project; updates .mhdd24rc)

Project insight:
  mhdd24 detect         (auto framework detection → .mhdd24rc)
  mhdd24 dashboard [port]   (local web UI, default 3847; MHDD_DASH_PORT)

Dev:
  mhdd24 doctor
  mhdd24 logs
  mhdd24 analyze
  mhdd24 rollback
  mhdd24 smart-commit

Env:
  mhdd24 env KEY VALUE

Git:
  mhdd24 branch <name>
  mhdd24 switch <name>
  mhdd24 clean-git
  mhdd24 pull
  mhdd24 status

Project:
  mhdd24 init
  mhdd24 open
  mhdd24 open-url <url>

Other:
  mhdd24 seed [en,de,ta,ml]
  mhdd24 build
  mhdd24 deploy-only
`);
}