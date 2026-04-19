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

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>mhdd24 dashboard</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2332;
      --text: #e7ecf3;
      --muted: #8b9bb4;
      --accent: #5ad8a6;
      --border: #2d3a4d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }
    header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    header h1 { font-size: 1.1rem; margin: 0; font-weight: 600; }
    header span { color: var(--muted); font-size: 0.85rem; word-break: break-all; }
    main { padding: 1.25rem 1.5rem 2rem; max-width: 960px; margin: 0 auto; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
    }
    .card h2 { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .kv { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; font-size: 0.95rem; margin: 0.35rem 0; }
    .kv dt { color: var(--muted); flex-shrink: 0; }
    .kv dd { margin: 0; text-align: right; word-break: break-word; max-width: 65%; }
    pre {
      margin: 0.5rem 0 0;
      padding: 0.65rem 0.75rem;
      background: #0b0f14;
      border-radius: 8px;
      border: 1px solid var(--border);
      font-size: 0.78rem;
      overflow: auto;
      max-height: 200px;
      color: #c8d7e9;
    }
    .pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; background: #243044; color: var(--accent); font-size: 0.8rem; }
    .links a { color: #7ec8ff; text-decoration: none; margin-right: 0.75rem; }
    .links a:hover { text-decoration: underline; }
    .err { color: #ff8a8a; font-size: 0.9rem; }
    footer { padding: 1rem 1.5rem; color: var(--muted); font-size: 0.8rem; text-align: center; border-top: 1px solid var(--border); }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>mhdd24 dashboard</h1>
      <span id="cwd"></span>
    </div>
    <div class="links">
      <a href="/api/status" target="_blank" rel="noreferrer">status.json</a>
      <a href="https://vercel.com/docs" target="_blank" rel="noreferrer">Vercel docs</a>
    </div>
  </header>
  <main>
    <p id="load" class="err">Loading…</p>
    <div id="app" class="grid" style="display:none"></div>
  </main>
  <footer>Local panel only — binds to 127.0.0.1. Run commands from your terminal.</footer>
  <script>
    async function load() {
      const loadEl = document.getElementById('load');
      const app = document.getElementById('app');
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        loadEl.style.display = 'none';
        app.style.display = 'grid';
        document.getElementById('cwd').textContent = data.cwd || '';

        const fw = data.framework || {};
        const git = data.git || {};
        const rc = data.rc || {};
        const tools = data.tools || {};
        const v = data.vercel || {};

        app.innerHTML = [
          card('Framework', [
            row('Detected', '<span class="pill">' + esc(fw.label || '—') + '</span>'),
            row('Id', esc(fw.id)),
            row('Package manager', esc(fw.packageManager)),
            row('Suggested build', esc(fw.buildCommand)),
            row('Evidence', (fw.evidence && fw.evidence.length) ? '<pre>' + esc((fw.evidence || []).join('\\n')) + '</pre>' : '—')
          ]),
          card('Git', [
            row('Branch', esc(git.branch || '—')),
            row('Origin', esc(git.origin || '—')),
            row('Dirty files', String(git.dirtyLines ?? 0)),
            git.dirtyPreview && git.dirtyPreview.length
              ? '<pre>' + esc(git.dirtyPreview.join('\\n')) + '</pre>'
              : ''
          ]),
          card('.mhdd24rc', [
            '<pre>' + esc(JSON.stringify(rc, null, 2)) + '</pre>'
          ]),
          card('Vercel', [
            row('Linked', v.linked ? 'yes' : 'no'),
            v.projectJson
              ? '<pre>' + esc(JSON.stringify(v.projectJson, null, 2)) + '</pre>'
              : '<p style="margin:0;color:var(--muted);font-size:0.9rem">Run <code>mhdd24 vercel-setup</code> in this repo.</p>'
          ]),
          card('Tools', [
            row('Node', esc(tools.node || '—')),
            row('Node path', esc(tools.nodePath || '—')),
            row('npm', esc(tools.npm || '—')),
            row('npm path', esc(tools.npmPath || '—')),
            row('Git', esc(tools.git || '—')),
            row('Vercel CLI', esc(tools.vercel || '—')),
            row('GitHub CLI', esc(tools.gh || '—'))
          ])
        ].join('');
      } catch (e) {
        loadEl.textContent = 'Failed to load status: ' + e;
      }
    }
    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
    }
    function row(k, v) {
      if (!v) return '';
      return '<div class="kv"><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>';
    }
    function card(title, parts) {
      return '<section class="card"><h2>' + esc(title) + '</h2>' + parts.filter(Boolean).join('') + '</section>';
    }
    load();
    setInterval(load, 8000);
  </script>
</body>
</html>`;

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
