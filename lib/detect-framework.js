const fs = require("fs");
const path = require("path");

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function detectPackageManager(cwd) {
  if (fileExists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(cwd, "bun.lockb")) || fileExists(path.join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

function depsFromPkg(pkg) {
  const d = { ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) };
  return d;
}

function hasDep(deps, name) {
  return Object.prototype.hasOwnProperty.call(deps, name);
}

/**
 * @param {string} [cwd]
 * @returns {{
 *   id: string;
 *   label: string;
 *   packageManager: string;
 *   buildCommand: string;
 *   devCommand: string | null;
 *   evidence: string[];
 * }}
 */
function detectFramework(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, "package.json");
  const pkg = readJsonSafe(pkgPath);
  const deps = depsFromPkg(pkg);
  const pm = detectPackageManager(cwd);
  const run = pm === "npm" ? "npm run" : pm === "pnpm" ? "pnpm run" : pm === "yarn" ? "yarn" : "bun run";
  const evidence = [];

  const scripts = (pkg && pkg.scripts) || {};
  const buildFromScripts = scripts.build ? `${run} build` : null;
  const devFromScripts = scripts.dev ? `${run} dev` : null;

  const nextConfigs = ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"];
  const nextCfg = nextConfigs.find((f) => fileExists(path.join(cwd, f)));
  if (hasDep(deps, "next") || nextCfg) {
    if (nextCfg) evidence.push(nextCfg);
    if (hasDep(deps, "next")) evidence.push("dependency: next");
    return {
      id: "next",
      label: "Next.js",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} dev`,
      evidence
    };
  }

  if (hasDep(deps, "@remix-run/react") || hasDep(deps, "@remix-run/node")) {
    evidence.push("dependency: @remix-run/*");
    return {
      id: "remix",
      label: "Remix",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} dev`,
      evidence
    };
  }

  if (hasDep(deps, "nuxt") || fileExists(path.join(cwd, "nuxt.config.ts")) || fileExists(path.join(cwd, "nuxt.config.js"))) {
    evidence.push("nuxt config or dependency");
    return {
      id: "nuxt",
      label: "Nuxt",
      packageManager: pm,
      buildCommand: buildFromScripts || "nuxi build",
      devCommand: devFromScripts || "nuxi dev",
      evidence
    };
  }

  if (hasDep(deps, "@sveltejs/kit") || fileExists(path.join(cwd, "svelte.config.js"))) {
    evidence.push("@sveltejs/kit or svelte.config.js");
    return {
      id: "sveltekit",
      label: "SvelteKit",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} dev`,
      evidence
    };
  }

  if (hasDep(deps, "astro")) {
    evidence.push("dependency: astro");
    return {
      id: "astro",
      label: "Astro",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} dev`,
      evidence
    };
  }

  if (fileExists(path.join(cwd, "angular.json")) || hasDep(deps, "@angular/core")) {
    evidence.push("angular.json or @angular/core");
    return {
      id: "angular",
      label: "Angular",
      packageManager: pm,
      buildCommand: buildFromScripts || "ng build",
      devCommand: devFromScripts || "ng serve",
      evidence
    };
  }

  if (hasDep(deps, "react-scripts")) {
    evidence.push("dependency: react-scripts");
    return {
      id: "cra",
      label: "Create React App",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} start`,
      evidence
    };
  }

  if (hasDep(deps, "vite") || fileExists(path.join(cwd, "vite.config.ts")) || fileExists(path.join(cwd, "vite.config.js"))) {
    evidence.push("vite");
    const react = hasDep(deps, "react");
    return {
      id: react ? "vite-react" : "vite",
      label: react ? "Vite + React" : "Vite",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts || `${run} dev`,
      evidence
    };
  }

  if (hasDep(deps, "expo") || fileExists(path.join(cwd, "app.json"))) {
    evidence.push("expo / app.json");
    return {
      id: "expo",
      label: "Expo",
      packageManager: pm,
      buildCommand: buildFromScripts || "npx expo export",
      devCommand: devFromScripts || "npx expo start",
      evidence
    };
  }

  if (pkg) {
    evidence.push("package.json present");
    return {
      id: "node",
      label: "Node / generic",
      packageManager: pm,
      buildCommand: buildFromScripts || `${run} build`,
      devCommand: devFromScripts,
      evidence
    };
  }

  return {
    id: "unknown",
    label: "Unknown",
    packageManager: pm,
    buildCommand: "npm run build",
    devCommand: null,
    evidence: ["no package.json"]
  };
}

module.exports = { detectFramework, detectPackageManager };
