const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { detectFramework } = require("./detect-framework");

function readMhddRc(cwd) {
  const p = path.join(cwd, ".mhdd24rc");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function safeGit(cwd, args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function vercelLinked(cwd) {
  return fs.existsSync(path.join(cwd, ".vercel", "project.json"));
}

function readVercelProject(cwd) {
  try {
    const raw = fs.readFileSync(path.join(cwd, ".vercel", "project.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function collectStatus(cwd) {
  const framework = detectFramework(cwd);
  const rc = readMhddRc(cwd);
  const branch = safeGit(cwd, "branch --show-current");
  const remote = safeGit(cwd, "remote get-url origin");
  const dirty = safeGit(cwd, "status --porcelain");
  const pkgPath = path.join(cwd, "package.json");
  const pkgExists = fs.existsSync(pkgPath);
  let pkgName = null;
  if (pkgExists) {
    try {
      pkgName = JSON.parse(fs.readFileSync(pkgPath, "utf8")).name || null;
    } catch {
      pkgName = null;
    }
  }

  return {
    cwd,
    packageName: pkgName,
    framework,
    rc,
    git: {
      branch,
      origin: remote,
      dirtyLines: dirty ? dirty.split("\n").filter(Boolean).length : 0,
      dirtyPreview: dirty ? dirty.split("\n").slice(0, 12) : []
    },
    vercel: {
      linked: vercelLinked(cwd),
      projectJson: readVercelProject(cwd)
    },
    tools: {
      node: safeVersion("node -v"),
      nodePath: safeCmdPath("node"),
      npm: safeVersion("npm -v"),
      npmPath: safeCmdPath("npm"),
      git: safeVersion("git --version"),
      vercel: safeVersion("vercel -v"),
      gh: safeVersion("gh --version")
    },
    meta: {
      vercelDeployment: process.env.VERCEL === "1",
      hint:
        process.env.VERCEL === "1"
          ? "Hosted preview: data reflects this deployment. Run mhdd24 dashboard on your machine for your own repo."
          : null
    }
  };
}

function safeVersion(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

function safeCmdPath(name) {
  try {
    return execSync(`command -v ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .trim()
      .split("\n")[0];
  } catch {
    return null;
  }
}

const PAGE_HTML = fs.readFileSync(path.join(__dirname, "dashboard-ui.html"), "utf8");


function startDashboard(options) {
  const cwd = options.cwd || process.cwd();
  const port = Number(options.port) || 3847;
  const host = "127.0.0.1";

  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "GET" && url === "/api/status") {
      const body = JSON.stringify(collectStatus(cwd));
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
      return;
    }
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE_HTML);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.listen(port, host, () => {
    const url = `http://${host}:${port}/`;
    console.log(`\n📊 mhdd24 dashboard → ${url}`);
    console.log("   (local only — press Ctrl+C to stop)\n");
    try {
      execSync(`open "${url}"`, { stdio: "ignore" });
    } catch {
      /* non-mac or no open */
    }
  });

  return server;
}

module.exports = { startDashboard, collectStatus };
