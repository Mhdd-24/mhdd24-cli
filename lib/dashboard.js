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
  <meta name="color-scheme" content="dark" />
  <title>mhdd24 · dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-deep: #07080d;
      --bg: #0c0e14;
      --surface: rgba(22, 26, 38, 0.72);
      --surface-solid: #161a26;
      --border: rgba(120, 140, 180, 0.14);
      --border-strong: rgba(120, 140, 180, 0.22);
      --text: #f0f2f7;
      --text-secondary: #9aa4b8;
      --accent: #3ee8b0;
      --accent-dim: rgba(62, 232, 176, 0.15);
      --violet: #a78bfa;
      --violet-dim: rgba(167, 139, 250, 0.12);
      --warn: #fbbf24;
      --danger: #f87171;
      --radius: 14px;
      --radius-sm: 10px;
      --shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
      --font: "DM Sans", ui-sans-serif, system-ui, sans-serif;
      --mono: "JetBrains Mono", ui-monospace, monospace;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { -webkit-font-smoothing: antialiased; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.55;
      color: var(--text);
      background: var(--bg-deep);
    }
    .mesh {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 100% 80% at 0% -20%, rgba(62, 232, 176, 0.18), transparent 50%),
        radial-gradient(ellipse 80% 60% at 100% 0%, rgba(167, 139, 250, 0.14), transparent 45%),
        radial-gradient(ellipse 60% 40% at 50% 100%, rgba(56, 189, 248, 0.06), transparent 40%),
        linear-gradient(180deg, var(--bg-deep) 0%, var(--bg) 35%, #0a0b10 100%);
    }
    .wrap {
      position: relative;
      z-index: 1;
      max-width: 1120px;
      margin: 0 auto;
      padding: 1.5rem clamp(1rem, 4vw, 2rem) 2.5rem;
    }
    header.top {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent) 0%, #22d3ee 100%);
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 1.1rem;
      color: #04120e;
      letter-spacing: -0.03em;
      box-shadow: 0 8px 32px rgba(62, 232, 176, 0.35);
    }
    .brand-text h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .brand-text .sub {
      margin: 0.2rem 0 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .path-block {
      margin-top: 0.75rem;
      padding: 0.5rem 0.85rem;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--text-secondary);
      word-break: break-all;
      max-width: min(100%, 52rem);
    }
    .path-block .pkg {
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 0.25rem;
      font-size: 0.8rem;
    }
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: var(--accent-dim);
      border: 1px solid rgba(62, 232, 176, 0.35);
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--accent);
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.65; transform: scale(0.92); }
    }
    .muted-time {
      font-size: 0.78rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.95rem;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      font-family: inherit;
      text-decoration: none;
      border: 1px solid var(--border-strong);
      color: var(--text);
      background: var(--surface);
      backdrop-filter: blur(12px);
      transition: border-color 0.15s, background 0.15s, transform 0.12s;
    }
    .btn:hover {
      border-color: rgba(62, 232, 176, 0.45);
      background: rgba(30, 36, 52, 0.9);
      transform: translateY(-1px);
    }
    .btn-primary {
      border-color: rgba(167, 139, 250, 0.45);
      background: var(--violet-dim);
      color: #ddd6fe;
    }
    .btn-primary:hover {
      border-color: rgba(167, 139, 250, 0.7);
      color: #fff;
    }
    main { margin-top: 0.5rem; }
    .grid {
      display: grid;
      gap: 1.1rem;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
    .card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.15rem 1.25rem;
      box-shadow: var(--shadow);
      transition: border-color 0.2s, transform 0.2s;
    }
    .card:hover {
      border-color: rgba(120, 140, 180, 0.2);
      transform: translateY(-2px);
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .card h2 {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
    }
    .card-icon {
      font-size: 1.1rem;
      opacity: 0.85;
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      font-size: 0.9rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(120, 140, 180, 0.08);
    }
    .kv:last-of-type { border-bottom: none; }
    .kv dt {
      color: var(--text-secondary);
      flex-shrink: 0;
      font-weight: 500;
    }
    .kv dd {
      margin: 0;
      text-align: right;
      word-break: break-word;
      max-width: 62%;
      font-weight: 500;
    }
    pre, .code {
      margin: 0.65rem 0 0;
      padding: 0.85rem 1rem;
      background: rgba(0, 0, 0, 0.4);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      font-family: var(--mono);
      font-size: 0.72rem;
      line-height: 1.5;
      overflow: auto;
      max-height: 220px;
      color: #c4d0e8;
    }
    .pill {
      display: inline-block;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      background: var(--violet-dim);
      border: 1px solid rgba(167, 139, 250, 0.35);
      color: #ddd6fe;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .pill.ok {
      background: var(--accent-dim);
      border-color: rgba(62, 232, 176, 0.4);
      color: var(--accent);
    }
    .pill.warn {
      background: rgba(251, 191, 36, 0.12);
      border-color: rgba(251, 191, 36, 0.35);
      color: var(--warn);
    }
    .hint {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .hint code {
      font-family: var(--mono);
      font-size: 0.8em;
      padding: 0.12rem 0.35rem;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      color: #e2e8f0;
    }
    .load-state {
      text-align: center;
      padding: 4rem 1.5rem;
      color: var(--text-secondary);
    }
    .load-state p { margin: 0 0 1rem; font-weight: 500; }
    .skeleton-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      max-width: 900px;
      margin: 0 auto;
    }
    .sk {
      height: 140px;
      border-radius: var(--radius);
      background: linear-gradient(90deg, var(--surface-solid) 25%, rgba(40, 48, 68, 0.6) 50%, var(--surface-solid) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
      border: 1px solid var(--border);
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .err { color: var(--danger); font-weight: 500; }
    footer {
      margin-top: 2.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.78rem;
      color: var(--text-secondary);
    }
    .span-2 { grid-column: 1 / -1; }
    @media (min-width: 900px) {
      .span-2 { grid-column: span 2; }
    }
  </style>
</head>
<body>
  <div class="mesh" aria-hidden="true"></div>
  <div class="wrap">
    <header class="top">
      <div>
        <div class="brand">
          <div class="logo">24</div>
          <div class="brand-text">
            <h1>mhdd24</h1>
            <p class="sub">Local project dashboard</p>
          </div>
        </div>
        <div class="path-block">
          <div class="pkg" id="pkg"></div>
          <div id="cwd"></div>
        </div>
      </div>
      <div class="header-actions">
        <span class="live"><span class="live-dot"></span> Live</span>
        <span class="muted-time" id="updated"></span>
        <a class="btn" href="/api/status" target="_blank" rel="noreferrer">JSON</a>
        <a class="btn btn-primary" href="https://vercel.com/docs" target="_blank" rel="noreferrer">Vercel docs</a>
      </div>
    </header>
    <main>
      <div id="load" class="load-state">
        <p>Loading project status…</p>
        <div class="skeleton-grid" aria-hidden="true">
          <div class="sk"></div><div class="sk"></div><div class="sk"></div>
        </div>
      </div>
      <div id="app" class="grid" style="display:none"></div>
    </main>
    <footer>Runs on 127.0.0.1 only · Refreshes every 8s · Use the CLI from your terminal</footer>
  </div>
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
        document.getElementById('pkg').textContent = data.packageName ? ('npm: ' + data.packageName) : '';
        document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();

        const fw = data.framework || {};
        const git = data.git || {};
        const rc = data.rc || {};
        const tools = data.tools || {};
        const v = data.vercel || {};

        app.innerHTML = [
          card('Framework', '◆', [
            row('Detected', '<span class="pill">' + esc(fw.label || '—') + '</span>'),
            row('Stack id', esc(fw.id || '—')),
            row('Package manager', esc(fw.packageManager || '—')),
            row('Suggested build', esc(fw.buildCommand || '—')),
            row('Evidence', (fw.evidence && fw.evidence.length) ? '<pre>' + esc((fw.evidence || []).join('\\n')) + '</pre>' : '—')
          ]),
          card('Git', '◇', [
            row('Branch', '<span class="pill ok">' + esc(git.branch || '—') + '</span>'),
            row('Origin', esc(git.origin || '—')),
            row('Dirty files', String(git.dirtyLines ?? 0)),
            git.dirtyPreview && git.dirtyPreview.length
              ? '<pre>' + esc(git.dirtyPreview.join('\\n')) + '</pre>'
              : ''
          ]),
          card('.mhdd24rc', '{ }', [
            '<pre>' + esc(JSON.stringify(rc, null, 2)) + '</pre>'
          ], 'span-2'),
          card('Vercel', '▲', [
            row('Linked', v.linked
              ? '<span class="pill ok">Connected</span>'
              : '<span class="pill warn">Not linked</span>'),
            v.projectJson
              ? '<pre>' + esc(JSON.stringify(v.projectJson, null, 2)) + '</pre>'
              : '<p class="hint">Run <code>mhdd24 vercel-setup</code> in this repo to link a project and GitHub remote.</p>'
          ]),
          card('Toolchain', '⚙', [
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
        loadEl.innerHTML = '<p class="err">Could not load status.</p><p class="hint">' + esc(String(e)) + '</p>';
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
    function card(title, icon, parts, extraClass) {
      var cls = 'card' + (extraClass ? ' ' + extraClass : '');
      return '<section class="' + cls + '"><div class="card-head"><h2>' + esc(title) + '</h2><span class="card-icon" aria-hidden="true">' + icon + '</span></div>' + parts.filter(Boolean).join('') + '</section>';
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
