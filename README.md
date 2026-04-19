# mhdd24-cli

Personal developer CLI (`mhdd24`) for git workflows, deploy helpers, **automatic framework detection**, **Vercel domain setup**, and a **local dashboard** that summarizes the current project.

## Install

```bash
npm install -g .
# or from npm when published
npm install -g mhdd24-cli
```

Global tools used by some commands (install as needed):

| Tool | Used for |
|------|----------|
| [Vercel CLI](https://vercel.com/docs/cli) | `vercel`, `vercel-setup`, `domain-add` |
| [GitHub CLI `gh`](https://cli.github.com/) | Picking a repo in `vercel-setup` |

## Quick start

```bash
cd your-repo
mhdd24 init              # creates .mhdd24rc (+ optional .env) with auto framework detection
mhdd24 doctor            # Node/npm versions + binary paths, git, Mongo, framework
mhdd24 dashboard         # local web panel → http://127.0.0.1:3847/
```

## Configuration (`.mhdd24rc`)

Stored at the **repository root**. Common fields:

| Field | Purpose |
|-------|---------|
| `build` | Command run by `mhdd24 build` / deploy step (default from **framework detection**) |
| `deploy` | Command run by `mhdd24 deploy-only` / deploy step |
| `framework` | Output of **auto detection** (`id`, `label`, `packageManager`, `buildCommand`, …) |
| `vercel.project` | Vercel project name (from `vercel-setup`) |
| `vercel.githubRepo` | `owner/repo` connected for Git deployments |
| `vercel.domains` | Domains added via `domain-add` (bookkeeping + docs) |
| `vercel.cliDeployAfterPush` | If `true`, runs `vercel deploy --prod --yes` after `push` / `deploy` / `smart-commit` |

## Auto framework detection

The CLI inspects `package.json` (dependencies and scripts), lockfiles, and common config files to infer your stack.

**Supported signals** (non-exhaustive): Next.js, Remix, Nuxt, SvelteKit, Astro, Angular, Create React App, Vite (+ React variant), Expo, generic Node when `package.json` exists.

**Package manager** is inferred from `pnpm-lock.yaml`, `yarn.lock`, or `bun.lock` / `bun.lockb` (otherwise `npm`).

### Commands

```bash
mhdd24 detect            # prints detection JSON, writes framework → .mhdd24rc, optional sync of "build"
```

`mhdd24 init` runs the same detector when `package.json` is present and seeds `build` + `framework` accordingly.

## Auto domain setup (Vercel)

Attach a domain you control to the **linked** Vercel project (run `mhdd24 vercel-setup` first if needed).

```bash
mhdd24 domain-add app.example.com
```

- Uses `vercel domains add` with your project name from `.mhdd24rc` → `vercel.project` when set.
- Appends the domain to `vercel.domains` in `.mhdd24rc`.
- Afterward, configure **DNS** at your registrar or DNS host so traffic reaches Vercel. See [Vercel: Domains](https://vercel.com/docs/concepts/projects/domains).

## Dashboard (web panel)

Read-only local UI for the **current working directory** (run it inside a project repo). The panel uses a **dark theme** (gradient mesh, glass-style cards, **DM Sans** + **JetBrains Mono** via Google Fonts when online).

```bash
mhdd24 dashboard         # default port 3847
mhdd24 dashboard 9000    # custom port
MHDD_DASH_PORT=9000 mhdd24 dashboard
```

- Binds to **127.0.0.1** only (not exposed on the LAN).
- **Cards**: detected framework, git branch / origin / short dirty preview, full `.mhdd24rc` JSON, Vercel link status (reads `.vercel/project.json` if present), tool versions.
- Live refresh about every **8 seconds**.
- On macOS, tries to `open` the URL in your browser.

JSON API: `GET http://127.0.0.1:3847/api/status`

## Vercel workflow

```bash
mhdd24 vercel-setup      # choose GitHub repo (gh or manual), vercel link, vercel git connect
mhdd24 vercel            # production deploy now (vercel deploy --prod --yes)
```

With `vercel.cliDeployAfterPush: true`, pushes from `mhdd24 push`, `mhdd24 deploy`, or `mhdd24 smart-commit` also trigger a Vercel production deploy via the CLI after `git push`.

## All commands (reference)

**Core**

- `mhdd24 push "message"` — add, commit, push; optional Vercel per rc
- `mhdd24 deploy "message"` — push (+ optional Vercel), `build`, `deploy` scripts from rc
- `mhdd24 release` — standard-version, push, tags, npm publish (OTP)
- **`mhdd24 version`** — wraps [`npm version`](https://docs.npmjs.com/cli/v10/commands/npm-version) to bump `package.json` semver:
  - `mhdd24 version` or `mhdd24 version patch` — patch bump (default)
  - `mhdd24 version minor` / `major` — explicit level
  - **`mhdd24 version auto`** — **auto-matched** bump from git history since the **latest tag** (or last 30 commits if no tag): `feat:` → **minor**, `type!:` / `BREAKING CHANGE` → **major**, otherwise **patch**
  - Add **`--no-git-tag-version`** anywhere on the command line to only change `package.json` (no version commit/tag from npm)

**Vercel & domains**

- `mhdd24 vercel-setup`
- `mhdd24 vercel`
- `mhdd24 domain-add <domain>`

**Insight**

- `mhdd24 detect`
- `mhdd24 dashboard [port]`

**Dev**

- `mhdd24 doctor` — prints `node` / `npm` versions and their `PATH` locations (`command -v`)
- `mhdd24 logs` — `tail -f logs/app.log`
- `mhdd24 analyze` — source-map-explorer
- `mhdd24 rollback` — soft reset last commit
- `mhdd24 smart-commit`

**Env**

- `mhdd24 env KEY VALUE` — append to `.env`

**Git**

- `mhdd24 branch <name>`, `switch <name>`, `pull`, `status`, `clean-git`

**Project**

- `mhdd24 init`, `open`, `open-url <url>`
- `mhdd24 build`, `deploy-only`, `clean`

**Other**

- `mhdd24 seed [langs]` — Mongo seed helper for specific project layout

## License

MIT

## Author

Mohammed Rafi
