# heroku plugin — consolidated skills reference

> Auto-consolidated from `/Users/beau/.cursor/plugins/local/heroku` on 2026-07-18T22:56:40.013Z
> Every `.md`/`.mdc` file under the plugin directory is included below, grouped by category. Frontmatter is rendered as yaml; the body is preserved as markdown.
> The canonical machine-readable plugin still lives at the source path above — this file is a portable reference bundle.

## Table of contents
1. [skills](#skills) — 28 file(s)
2. [rules](#rules) — 2 file(s)
3. [agents](#agents) — 1 file(s)
4. [commands](#commands) — 8 file(s)
5. [README.md](#readmemd) — 1 file(s)
6. [CHANGELOG.md](#changelogmd) — 1 file(s)

## skills

### `skills/access/SKILL.md`

```yaml
---
name: heroku-access
description: Manage app collaborators with `heroku access` — list, add, remove, update roles. Pairs with the orgs skill for team-level membership.
---
```

# Heroku app access (`heroku access`)

Per-app collaborators. Use `heroku members` (see the `orgs` skill) for team-level membership.

## Commands

```bash
heroku access -a <app>                       # list collaborators + roles
heroku access -a <app> --json

heroku access:add user@example.com -a <app>
heroku access:add user@example.com -a <app> --permissions deploy,operate   # (enterprise)

heroku access:update user@example.com -a <app> --role admin
heroku access:remove user@example.com -a <app>     # DESTRUCTIVE — see safety rule
```

## Roles

For team/enterprise apps, roles typically include: `admin`, `deployer`, `member`, `operator`, `viewer`. Personal apps use a simpler collaborator model. Check `heroku access:add --help` locally — available roles depend on the team type.

## Pitfalls

- Removing a collaborator mid-deploy can interrupt their `heroku run` sessions.
- Adding a collaborator who isn't a Heroku user sends an invite; they must accept before access is live.
- `access:remove` is irreversible without re-adding — confirm before bulk-removing.

---

### `skills/addons/SKILL.md`

```yaml
---
name: heroku-addons
description: Manage Heroku add-ons with `heroku addons` — list, create, attach/detach, destroy, upgrade, plans, services, info, wait. Explains attachments, *_URL config vars, and the add-on marketplace.
---
```

# Heroku add-ons (`heroku addons`)

Add-ons are managed services from Heroku's marketplace — Postgres, Redis, Kafka, search, email, monitoring, logging, etc. Provisioning an add-on creates a **resource** and **attaches** it to an app, exposing connection info as config vars (e.g. `DATABASE_URL`, `REDIS_URL`, `KAFKA_URL`).

## Listing

```bash
heroku addons                              # add-ons for the current app (or --all if no app)
heroku addons -a <app>                     # add-ons for a specific app
heroku addons -A                           # across all accessible apps
heroku addons --json
heroku addons --no-wrap                    # easier copy/paste
```

## Discovery

```bash
heroku addons:services                     # every available service (slug + name)
heroku addons:services --json
heroku addons:plans <service-slug>         # plans for a service, e.g. heroku-postgresql
heroku addons:plans heroku-postgresql --json
heroku addons:docs <service-slug>          # open Dev Center page in browser
```

Plan slugs look like `heroku-postgresql:essential-0`, `heroku-redis:mini`, `papertrail:choklad`. Always check `addons:plans` before scripting — plan names change.

## Creating / attaching

```bash
heroku addons:create <service:plan> -a <app>
heroku addons:create heroku-postgresql:essential-0 -a <app>
heroku addons:create heroku-postgresql:essential-0 --as DATABASE -a <app>   # alias
heroku addons:create heroku-redis:mini --follow DATABASE -a <app>           # follower (Postgres)

# Attach an existing add-on to another app (share the resource)
heroku addons:attach <addon-id-or-name> -a <other-app> --as <ALIAS>
heroku addons:detach <alias-or-name> -a <app>
```

When you attach with `--as <ALIAS>`, the exposed config var becomes `<ALIAS>_URL` (e.g. `--as SHARED_DB` → `SHARED_DB_URL`). Use this to share one DB across multiple apps.

## Information & status

```bash
heroku addons:info <addon-or-alias> -a <app>
heroku addons:open <addon-or-alias> -a <app>     # open add-on's own dashboard
heroku addons:wait -a <app>                      # wait for all provisioning ops to finish
```

## Upgrading / downgrading

```bash
heroku addons:upgrade <addon> <new-plan> -a <app>
heroku addons:rename <old> <new> -a <app>
heroku addons:destroy <addon> -a <app> --confirm <addon>   # DESTRUCTIVE — see safety rule
```

Database add-on downgrades can be blocked if the data exceeds the smaller plan's limits. Upgrades are usually online but may briefly affect performance.

## Common add-on categories

| Category | Examples |
| --- | --- |
| Data | `heroku-postgresql`, `heroku-redis`, `apache-kafka-on-heroku`, `memcachier`, `bonsai-elasticsearch` |
| Monitoring | `newrelic`, `datadog`, `librato`, `scout`, `rollbar` |
| Logging | `papertrail`, `logdna`, `timber-logging` |
| Email | `sendgrid`, `mailgun`, `postmark` |
| Search | `bonsai-26` (Elasticsearch/Meilisearch), `algoliasearch` |
| Scheduler | `scheduler` (Heroku Scheduler), `toad-scheduler` |
| Error tracking | `sentry`, `rollbar`, `honeybadger` |

`heroku addons:services | grep -i <topic>` to discover on this machine.

## Pitfalls

- **`addons:destroy` permanently deletes data** for DB add-ons. Always confirm the alias/name twice. For Postgres, prefer `pg:backups:capture` first (see the `postgres` skill).
- Plan names drift. `heroku-postgresql` retired the old `hobby-dev`/`standard-...` tiers; current plans are `essential-0..4`, `premium-*`, `shield-*`. Always `addons:plans` to confirm.
- Attaching an add-on to multiple apps does **not** share connection pooling — each app gets its own connection string to the same resource. Watch the connection limit of the plan.
- Provisioning is async. After `addons:create`, run `addons:wait` (or `pg:wait` / `redis:wait`) before scripting against the new `*_URL`.

---

### `skills/apps/SKILL.md`

```yaml
---
name: heroku-apps
description: Manage Heroku apps with the `heroku apps` topic — create, destroy, inspect, list, errors, stacks, open, lock/join/leave, favorites, diffs. Covers Cedar and Fir generations.
---
```

# Heroku apps (`heroku apps`)

Manage the app objects themselves — not their dynos, add-ons, or config (those have their own skills).

## Core commands

```bash
heroku apps                                # list apps you can see
heroku apps -A                             # include apps in all teams
heroku apps -p                             # personal account only (when a default team is set)
heroku apps -t <team>                      # filter by team
heroku apps -s <space>                     # filter by Private Space
heroku apps --json                         # machine-readable

heroku apps:create <name>                  # create; auto-adds `heroku` git remote
heroku apps:create --team <team> <name>
heroku apps:create --region <region> --stack <stack> --buildpack <url> <name>
heroku apps:create --addons <csv> <name>   # e.g. heroku-postgresql:essential-0,heroku-redis:mini
heroku apps:create --space <space> <name>  # Private Space app
heroku apps:create --no-remote <name>      # don't add a git remote

heroku apps:info -a <app>                  # owner, region, stack, git/web URLs, dynos
heroku apps:info -a <app> --json
heroku apps:open -a <app>                  # open in browser
heroku apps:open /docs -a <app>            # open a specific path

heroku apps:destroy -a <app> --confirm <app>   # DESTRUCTIVE — see safety rule
heroku apps:rename <new> -a <app>

heroku apps:errors -a <app>                # router + dyno error counts (last 24h)
heroku apps:errors -a <app> --hours 72 --json --router

heroku apps:stacks -a <app>                # available + current stack
heroku apps:stacks:set heroku-24 -a <app>  # change stack on next deploy

heroku apps:diff -a <app>                  # diff an app against its pipeline downstream
heroku apps:favorites                      # list favorites
heroku apps:favorites:add -a <app>
heroku apps:favorites:remove -a <app>

heroku apps:lock -a <app>                  # prevent team members from joining
heroku apps:unlock -a <app>
heroku apps:join -a <app>                  # add yourself to a team app
heroku apps:leave -a <app>                 # remove yourself
```

## Generations

- **Cedar** — the long-standing generation, used by Common Runtime and Private/Shield Spaces. Stacks: `heroku-22`, `heroku-24` (and older).
- **Fir** — newer, Kubernetes-based, uses Cloud Native Buildpacks. Stack names like `heroku-24` are not the generation; check `apps:info` for the generation field.

A pipeline can only contain apps from one generation — don't mix Cedar and Fir in the same pipeline (see the `pipelines` skill).

## Stacks

- `heroku apps:stacks` lists what's available and which is current.
- Stack changes apply on the **next deploy**, not immediately. Don't change stacks mid-release without coordination.

## App discovery

- Inside a Git clone with a `heroku` remote, app commands auto-discover the target. For agent runs, **always pass `--app`** explicitly (see the safety rule).
- `HEROKU_APP=<name>` in the env also works but is easy to forget; prefer the flag.

## Creating an app — common combos

```bash
# Standard web app
heroku apps:create my-app --team my-team --region us --stack heroku-24

# With Postgres and Redis pre-attached
heroku apps:create my-app --addons heroku-postgresql:essential-0,heroku-redis:mini

# Private Space
heroku apps:create my-app --space my-space --team my-team

# Container-based (Fir/CNB)
heroku apps:create my-app --stack heroku-24
# then: heroku container:push web && heroku container:release web
```

## Errors

`apps:errors` reports router errors (5xx, timeouts) and dyno errors (R14 memory, H12 timeout, etc.) over a window. Use `--router` or `--dyno` to split. Pair with `heroku logs` (see the `logs` skill) to drill in.

## Pitfalls

- `apps:destroy` is irreversible and also destroys add-ons (including databases). Always pass `--confirm <app>`; the CLI requires the exact app name.
- Renaming an app changes its `*.herokuapp.com` hostname and git URL. Existing custom domains keep working, but the old herokuapp subdomain is released.
- `apps:stacks:set` does not redeploy. Schedule it with a release.

---

### `skills/auth/SKILL.md`

```yaml
---
name: heroku-auth
description: Manage Heroku authentication with `heroku auth` and `heroku authorizations` — login, logout, token, whoami, OAuth authorizations, sessions, 2FA.
---
```

# Heroku authentication (`heroku auth`, `heroku authorizations`, `heroku sessions`)

## Whoami + token

```bash
heroku auth:whoami                  # current user
heroku auth:token                   # current CLI token (treat as a secret — don't echo)
```

The CLI stores session info in `~/.netrc` (or `%USERPROFILE%\_netrc` on Windows). `heroku auth:token` prints the bearer token the CLI uses; useful for scripting curl against the Platform API, but **don't paste it into chat** (safety rule).

## Login / logout

```bash
heroku login                        # browser SSO (preferred)
heroku login -i                     # interactive username/password (deprecated for many accounts; may require 2FA)
heroku login --browser firefox      # use a specific browser
heroku login --expires-in 2592000   # token valid 30 days
heroku logout                       # clear local creds + invalidate session
heroku auth:login                   # alias of `heroku login`
heroku auth:logout                  # alias of `heroku logout`
```

The plugin does **not** log in on the user's behalf — `heroku login` is interactive and browser-based. If a command fails with "not authenticated", tell the user to run `heroku login` and re-invoke.

## OAuth authorizations (long-lived API tokens)

```bash
heroku authorizations                            # list
heroku authorizations --json
heroku authorizations:create --description "CI deploy token" --scope global --expires-in 2592000
heroku authorizations:info <id>
heroku authorizations:rotate <id>                # rotate the token value (old stops working)
heroku authorizations:update <id> --description "..."
heroku authorizations:revoke <id>                # DESTRUCTIVE — invalidates the token
```

A token from `authorizations:create` is what you set as `HEROKU_API_KEY` for CI/CD. **Store it in a secret manager**, not the repo. Rotate at least annually.

## Sessions

```bash
heroku sessions                     # active OAuth sessions
heroku sessions --json
heroku sessions:destroy <id>        # log out a specific session (DESTRUCTIVE — see safety rule)
```

## 2FA

```bash
heroku auth:2fa                     # check 2FA status
heroku 2fa                          # alias
```

Many Heroku accounts require 2FA (enterprise teams mandate it). Interactive `heroku login -i` won't work without a TOTP flow — use the browser flow.

## Pitfalls

- `HEROKU_API_KEY` env var overrides the netrc session. If you set it, you're using that token, not `heroku login`'s.
- Tokens don't expire unless you set `--expires-in`. A leaked non-expiring token is a long-lived risk — rotate + revoke.
- `authorizations:revoke` immediately invalidates the token. Anything using it stops working.
- Don't `cat ~/.netrc` in a shell session the user can see — it has the token in plaintext.

---

### `skills/buildpacks/SKILL.md`

```yaml
---
name: heroku-buildpacks
description: Manage buildpacks with `heroku buildpacks` — list, add, remove, set, clear, search, versions, multi-buildpack ordering. Covers CNB (Fir) vs classic buildpacks.
---
```

# Heroku buildpacks (`heroku buildpacks`)

Buildpacks detect your language, install dependencies, and produce a slug (Cedar) or an OCI image (Fir CNB). Order matters for multi-buildpack setups.

## Listing

```bash
heroku buildpacks -a <app>
heroku buildpacks -a <app> --json
heroku buildpacks:info <url-or-name> -a <app>
```

## Set / add / remove

```bash
heroku buildpacks:set heroku/nodejs -a <app>            # replace the list with one buildpack
heroku buildpacks:add heroku/ruby -a <app>              # append (multi-buildpack)
heroku buildpacks:add heroku/nodejs -a <app> --index 1  # insert at position 1
heroku buildpacks:remove heroku/nodejs -a <app>
heroku buildpacks:clear -a <app>                        # remove all
```

`buildpacks:set` overwrites the entire list. Use `buildpacks:add` for multi-buildpack apps (e.g. Node for asset compilation + Ruby for the app).

## Discovery

```bash
heroku buildpacks:search                       # search the buildpack registry
heroku buildpacks:search node
heroku buildpacks:versions heroku/nodejs
```

Buildpack references can be:
- A registry name (`heroku/nodejs`, `heroku/ruby`).
- A Git URL (`https://github.com/heroku/heroku-buildpack-nodejs.git`).
- A Git URL with a branch/tag (`https://...#v123`).

## Multi-buildpack ordering

The first buildpack that detects the app "wins" as the primary — it produces the slug that runs. Subsequent buildpacks are there to provide tooling (e.g. a Node buildpack to compile assets for a Ruby app). Order matters: put the primary language first.

## Cedar vs Fir (CNB)

- **Cedar** uses classic buildpacks (the `heroku/*` ones). Detected in order, run in order.
- **Fir** uses Cloud Native Buildpacks (CNBs). The CLI commands are the same but the buildpacks must be CNB-compatible. Some `heroku/*` buildpacks have CNB variants; check `buildpacks:versions`.

You can't mix CNB and classic buildpacks on one app — the stack/generation decides.

## Pitfalls

- `buildpacks:set` replaces the list. Don't use it to "add" — use `buildpacks:add`.
- Changing buildpacks doesn't redeploy; the next deploy uses the new list.
- A custom buildpack from a random GitHub repo is a supply-chain risk. Prefer registry-named `heroku/*` or vetted buildpacks.
- Multi-buildpack order: if the wrong one is first, your app gets detected as the wrong language (e.g. a Node/Ruby app detected as Node and failing to start Rails).

---

### `skills/certs/SKILL.md`

```yaml
---
name: heroku-certs
description: Manage SSL certificates with `heroku certs` — add, update, remove, info, generate CSR/self-signed, ACM (auto cert management) status.
---
```

# Heroku SSL certificates (`heroku certs`)

TLS for custom domains. Two mechanisms:

- **ACM** (Automated Certificate Management) — Heroku provisions and renews Let's Encrypt certs for non-wildcard custom domains. Free.
- **SNI Endpoints** — you upload your own cert+key. Required for wildcard domains, EV certs, or domains ACM doesn't cover.

## ACM (auto cert management)

```bash
heroku certs:auto -a <app>                    # ACM status
heroku certs:auto:enable -a <app>
heroku certs:auto:disable -a <app>
```

ACM enables automatically when you add a non-wildcard custom domain with valid DNS. Disable if you're bringing your own cert. ACM does **not** cover wildcard domains.

## SNI endpoints (your own cert)

```bash
heroku certs -a <app>                         # list SNI endpoints
heroku certs:add cert.pem key.pem -a <app>            # returns the SNI endpoint name (e.g. tokyo-12345.herokussl.com)
heroku certs:update cert.pem key.pem -a <app> --name <existing-cert-name>
heroku certs:info <cert-name> -a <app>
heroku certs:remove <cert-name> -a <app>      # DESTRUCTIVE — TLS for that domain stops working
heroku certs:generate --domain www.example.com --owner you@example.com -a <app>
```

`certs:generate` produces either:
- a CSR (`--csr`) you submit to a CA, or
- a self-signed cert (`--selfsigned`) for testing.

The `certs:add` output gives you the SNI endpoint hostname — your DNS for that custom domain CNAMEs to it.

## Cert/key format

- PEM-encoded.
- Cert first, then any intermediates concatenated in the same file (full chain).
- Key must be unencrypted (no passphrase) for `certs:add`.

## Pitfalls

- ACM and a manual SNI cert on the same domain conflict. Pick one.
- Wildcard domains need a wildcard cert (`*.example.com`). ACM won't issue one.
- Removing a cert takes TLS down for the associated domain until you add another. Confirm before removing in production.
- `certs:update` swaps the cert without changing the SNI endpoint hostname — useful for renewal.
- Some cert chains need the full intermediate bundle or browsers will show "untrusted". Use `certs:info` to verify the chain Heroku sees.

---

### `skills/ci/SKILL.md`

```yaml
---
name: heroku-ci
description: Run Heroku CI tests on a GitHub-connected pipeline with `heroku ci` — list runs, watch, config vars, debug sessions.
---
```

# Heroku CI (`heroku ci`)

A visual test runner integrated with Heroku Pipelines. Turned on per pipeline in the dashboard **Settings** tab or by connecting GitHub via `pipelines:connect`. Test runs execute on dedicated CI dynos and are billed per second.

## Commands

```bash
heroku ci -a <app>                          # latest CI runs for the app's pipeline
heroku ci -p <pipeline>                     # by pipeline name
heroku ci --json
heroku ci --watch                           # keep running, stream updates
heroku ci:info <run-id> -a <app>
heroku ci:info <run-id> -a <app> --json
heroku ci:config -a <app>                   # CI-only config vars (not surfaced to runtime dynos)
heroku ci:config:set TEST_DB=... -a <app>
heroku ci:config:unset TEST_DB -a <app>
heroku ci:debug -a <app>                    # interactive shell inside a CI test dyno with current dir contents
```

`ci:debug` is invaluable for reproducing a failing test run: it uploads your local working directory, provisions a CI dyno, and drops you into bash. Use `--no-tty` for scripting.

## Setup

- Pipeline must be connected to a GitHub repo (`pipelines:connect`).
- `app.json` in the repo can specify `test` setup scripts and add-ons.
- CI runs are triggered automatically on push to GitHub branches watched by the pipeline.

## Pitfalls

- CI dynos and add-ons are billed like normal dynos (per second). Long suites cost real money.
- CI config vars are separate from app config vars. Setting a var with `heroku config:set` does not affect CI; use `ci:config:set`.
- `ci:debug` uploads your current directory — don't run it in a dir with secrets not in `.gitignore`.

---

### `skills/config/SKILL.md`

```yaml
---
name: heroku-config
description: Manage Heroku config vars with `heroku config` — set, get, unset, edit, JSON/shell output. Covers secret hygiene and reviewing config without leaking values.
---
```

# Heroku config vars (`heroku config`)

Per-app environment variables. Set at runtime, exposed to all dynos. Changing config vars **restarts all dynos** — be deliberate.

## Reading

```bash
heroku config -a <app>                 # table view (values visible — be careful with secrets)
heroku config -a <app> --json          # JSON
heroku config -a <app> --shell         # shell format (FOO=bar) for sourcing
heroku config:get DATABASE_URL -a <app>        # one value
heroku config:get DATABASE_URL -a <app> --shell
```

When reviewing config for the user, **redact secrets**. Replace the value of `*_URL`, `*_KEY`, `*_TOKEN`, `*_SECRET`, `SECRET_KEY_BASE`, `JWT_SECRET`, etc. with `***`. Show keys + whether they're set, not the values.

## Writing

```bash
heroku config:set FOO=bar BAZ=qux -a <app>
heroku config:set 'JWT_SECRET=$(openssl rand -hex 32)' -a <app>   # generated locally
heroku config:unset FOO BAZ -a <app>          # DESTRUCTIVE — restarts dynos
heroku config:edit -a <app>                   # interactive $EDITOR session
```

Multiple vars can be set in one command — preferred, since each call restarts dynos. Batch related changes.

## Where config comes from

- `config:set` by a human or agent.
- Add-on attachments: each attached add-on exposes one or more `*_URL` vars. Detaching (`addons:detach`) removes them.
- Review apps: `app.json` `env` block provisions initial vars on review-app creation.
- Pipelines: `pipelines:config` (rare; usually per-app).

Editing an add-on-exposed var via `config:set` is allowed but the add-on will **overwrite it on the next attachment event**. Manage DB URLs via `pg:promote` / `redis:promote` instead.

## Secret hygiene

- Never commit real Heroku config values to a repo. Use `.env.example` with placeholder values and `.env` gitignored.
- `heroku config -a <app> --shell > .env` is handy for local dev but **the file is full of secrets** — don't paste it back, don't commit it.
- Rotate `*_KEY` / `*_TOKEN` vars by setting a new value and verifying the app still works, then revoking the old credential at the provider.
- For `JWT_SECRET` / `SESSION_SECRET` style secrets, generate with `openssl rand -hex 32` (or `openssl rand -base64 48`) locally and pass the literal — don't let the shell expand `$()` inside the value unless you mean to.

## Pitfalls

- Every `config:set` / `config:unset` restarts **all** dynos. Batch.
- Setting an invalid value (e.g. malformed URL) for a var an app reads at boot will crash the next deploy. Verify with `heroku ps -a <app>` after.
- `config:edit` opens your `$EDITOR` on a temp file; saving with empty values unsets those keys. Be careful with bulk edits.

---

### `skills/container/SKILL.md`

```yaml
---
name: heroku-container
description: Deploy Docker-based apps with `heroku container` — login, push, release, pull, rm, run. Covers Dockerfile vs Procfile process types and the Container Registry.
---
```

# Heroku Container Registry (`heroku container`)

Deploy pre-built Docker images instead of having Heroku build from source. Useful for binaries, multi-language apps, or images you build in CI.

## Auth

```bash
heroku container:login              # docker login to registry.heroku.com (uses Heroku session)
heroku container:logout
```

## Push / release

```bash
heroku container:push web -a <app>                  # build ./Dockerfile, tag, push as 'web' process type
heroku container:push web worker -a <app>           # multiple process types
heroku container:push web -a <app> --recursive      # use Dockerfile.web, Dockerfile.worker, ...
heroku container:release web -a <app>               # promote pushed image to the running formation
heroku container:release web worker -a <app>
```

`push` uploads the image to the app's registry namespace. `release` swaps the formation to use the new image. **Push does not deploy** — you must release.

## Pull / rm / run

```bash
heroku container:pull web -a <app>                  # pull the current web image locally
heroku container:rm web -a <app>                    # remove the 'web' process type's image (DESTRUCTIVE — see safety rule)
heroku container:run --local web -a <app>           # build + run the image locally (no deploy)
```

## Dockerfile conventions

- The image must define a `CMD` or `ENTRYPOINT` matching the process type's command. Alternatively, include a `Procfile` in the image and `container:push` will use it.
- For multi-process apps, either use one `Dockerfile` with a `Procfile` or multiple `Dockerfile.<type>` files with `--recursive`.
- The image must run as a non-root user on Fir (uid > 1024). Cedar is more permissive.
- Expose one port via `$PORT` env var. Heroku sets it at runtime.

## Workflow

```bash
heroku container:login
heroku container:push web -a my-app
heroku container:release web -a my-app
heroku releases -a my-app                  # confirm the new release
heroku ps -a my-app                        # confirm dynos restarted
```

## Pitfalls

- `container:push` without `container:release` does nothing visible to users. Always release.
- The image must listen on `$PORT` (Heroku injects it). Hardcoding a port breaks the app.
- Image size matters for cold starts. Use multi-stage builds to keep images small.
- `container:rm <type>` removes the image from the registry and breaks the formation for that type. Scale to 0 first if you just want to stop it.
- On Fir, CNB-built images and `container:push`-ed images can coexist per process type but should not be mixed for the same process type.

---

### `skills/data/SKILL.md`

```yaml
---
name: heroku-data
description: Inspect Heroku data add-on maintenances with `heroku data` — `data:maintenances` and `data:pg` for Postgres Advanced attachments.
---
```

# Heroku data services (`heroku data`)

Covers data add-on metadata that's not specific to `pg` or `redis`: scheduled maintenances and Postgres Advanced (a higher-tier Heroku Postgres for enterprise) attachments.

## Commands

```bash
heroku data:maintenances -a <app>                  # upcoming + past maintenances for the app's data add-ons
heroku data:maintenances -a <app> --json
heroku data:pg -a <app>                            # list Postgres Advanced attachments on the app
heroku data:pg -a <app> --json
```

## When to use

- Before a deploy, run `data:maintenances` to make sure Heroku isn't about to maintenance your DB under you.
- For Postgres Advanced (different SKU set from `heroku-postgresql`), `data:pg` shows attachments and connection info — `pg:info` may not cover all of them.

## Pitfalls

- Maintenances often have an automatic window and only need action if you want to reschedule. Don't panic on seeing one.
- `data:pg` is for Postgres Advanced (enterprise). For standard Heroku Postgres, use `heroku pg` (see the `postgres` skill).

---

### `skills/domains/SKILL.md`

```yaml
---
name: heroku-domains
description: Manage custom domains with `heroku domains` — list, add, remove, wildcard, DNS targets, default app domain. Pairs with the certs skill for ACM.
---
```

# Heroku domains (`heroku domains`)

Custom hostname routing for your app. Every app gets `<name>.herokuapp.com` automatically; custom domains are added on top.

## Listing

```bash
heroku domains -a <app>                       # all domains + DNS targets
heroku domains -a <app> --json
heroku domains -a <app> --filter "hostname=example.com"
```

Output columns: `Domain Name`, `DNS Record Type`, `DNS Target`. The DNS target is `<something>.herokuapp.com` — you point your DNS at it (CNAME for subdomains; A records / ALIAS/ANAME for apex, depending on DNS provider).

## Add / remove

```bash
heroku domains:add www.example.com -a <app>
heroku domains:add example.com -a <app>              # apex — needs a DNS provider that supports ALIAS/ANAME/CNAME-flattening
heroku domains:add *.example.com -a <app>            # wildcard
heroku domains:remove www.example.com -a <app>       # DESTRUCTIVE — see safety rule
heroku domains:wait-for-verification www.example.com -a <app>
```

After adding, the CLI prints the DNS target to set in your DNS provider. Verification is automatic once DNS resolves.

## Wildcard domains

`*.example.com` covers any subdomain. The certificate for a wildcard domain must be a wildcard cert (see the `certs` skill). ACM (auto cert management) does **not** cover wildcard domains — you must supply your own.

## Default app domain

The `<name>.herokuapp.com` domain can't be removed. You can rename the app to change it (`apps:rename`), which releases the old subdomain.

## Pitfalls

- Apex domains: Heroku's DNS targets are CNAMEs. Apex CNAMEs are technically not RFC-valid, so use a DNS provider that does CNAME flattening (Cloudflare, DNSimple, Namecheap VIP, etc.). Without it, the apex won't resolve.
- Removing a domain that's serving production traffic takes the domain offline immediately. Confirm first.
- Adding a domain that's already in use by another Heroku app fails. Remove from the other app first.
- ACM only provisions certs for non-wildcard custom domains. Wildcards → bring your own cert (`certs:add`).

---

### `skills/dynos/SKILL.md`

```yaml
---
name: heroku-dynos
description: Manage Heroku dynos with `heroku ps` — list, scale (horizontal + vertical), restart, stop, kill, resize, exec, copy, forward, socks, wait, autoscale. Explains the formation model and the ps:stop-vs-scale gotcha.
---
```

# Heroku dynos (`heroku ps`)

Dynos are Heroku's unit of compute — isolated Linux containers running one process type from your `Procfile`. The **formation** is the desired state (which process types, how many, what size); running dynos are instances of the formation.

## Listing

```bash
heroku ps -a <app>                       # list all dynos
heroku ps web -a <app>                   # only web dynos
heroku ps -a <app> --json                # machine-readable
heroku ps -a <app> --no-wrap             # easier copy/paste
```

Output includes dyno name (e.g. `web.1`), state (`up`, `starting`, `crashed`, `idle`), size, age, and command.

## Scaling — horizontal (count)

```bash
heroku ps:scale web=2 -a <app>           # set web to 2 dynos
heroku ps:scale web+1 -a <app>           # increment
heroku ps:scale web=1 worker=3 -a <app>  # multiple types at once
heroku ps:scale web=0 -a <app>           # DESTRUCTIVE — stops the process type
```

## Scaling — vertical (size)

```bash
heroku ps:type web=standard-2x -a <app>
heroku ps:type worker=performance-l -a <app>
heroku ps:scale web=3:performance-l -a <app>   # combined: 3 dynos, size performance-l
```

Available sizes: `eco`, `basic`, `standard-1x`, `standard-2x`, `performance-m`, `performance-l`, `performance-xl`, `performance-2xl`. Private/Shield spaces add `private-*` and `shield-*` variants. Confirm with `heroku ps:type -a <app>` or the Dev Center — names drift.

## Restart / stop / kill

```bash
heroku ps:restart -a <app>               # all dynos
heroku ps:restart web -a <app>           # all web dynos
heroku ps:restart web.1 -a <app>         # a specific dyno

heroku ps:stop <dyno> -a <app>           # stop a one-off dyno or a Private Space dyno
heroku ps:kill <dyno> -a <app>           # force-kill a dyno
```

**Critical gotcha:** `ps:stop` and `ps:kill` on a dyno that is part of a **scaled** process type will **restart it automatically**. To actually take a process type offline, scale it to 0:

```bash
heroku ps:scale worker=0 -a <app>
```

In Private Spaces, `ps:stop` terminates and replaces the dedicated instance. This is consistent with the Platform API: `POST /apps/{name}/dynos/{id}/actions/stop` returns 200 but does not stop a scaled dyno — use `PATCH /apps/{name}/formation/{type}` with `quantity: 0`.

## Resize

`heroku ps:resize <type>=<size>` is an alias for `ps:type` on some versions. Prefer `ps:type` for clarity, and `ps:scale <type>=N:<size>` for combined ops.

## One-off dynos

`heroku run` (see the `run` skill) spawns one-off dynos. They show up in `heroku ps` with type `run.N` and are billed per second.

## Connecting to a running dyno

```bash
heroku ps:exec -a <app>                  # SSH session into a web dyno
heroku ps:exec web.2 -a <app>            # specific dyno
heroku ps:forward 8080 -a <app>          # local port → dyno port (Private Space)
heroku ps:socks -a <app>                 # SOCKS proxy into a Private Space
heroku ps:copy /app/logs/foo.log ./ -a <app>   # pull a file from a dyno
```

`ps:exec` requires the dyno to have an SSH daemon (most Cedar web dynos do; one-offs and some Fir setups may not).

## Waiting

```bash
heroku ps:wait -a <app>                  # block until all dynos run the latest release
```

Use after a deploy or `ps:scale` to know when the new formation is fully live.

## Autoscaling (web only)

```bash
heroku ps:autoscale:enable -a <app> --min 2 --max 10
heroku ps:autoscale:disable -a <app>
```

Only available on Performance-tier web dynos in the Common Runtime. The CLI may require a partner dashboard for full configuration; check `heroku ps:autoscale:enable --help` locally.

## Pitfalls

- `ps:scale web=0` is a fast way to take production offline. Always confirm the app name and process type first (safety rule).
- Eco dynos sleep after 30 min of inactivity and only one Eco dyno per process type is allowed — `ps:scale web=2` on an Eco app will fail.
- Basic dynos can't scale horizontally (`web=2` fails). Use Standard-1X+ for horizontal scaling.
- One-off `run` dynos are billed per second and don't count against the formation; forgetting to exit an interactive `heroku run bash` keeps the dyno alive.

---

### `skills/git/SKILL.md`

```yaml
---
name: heroku-git
description: Heroku git operations with `heroku git` — clone, set remote, deploy via git push. Covers the heroku remote convention.
---
```

# Heroku git (`heroku git`)

Heroku apps have a Git endpoint at `https://git.heroku.com/<app>.git`. Pushing to it triggers a build and release (the standard Heroku deploy flow).

## Commands

```bash
heroku git:clone -a <app>                # clone the app's git repo into ./<app>
heroku git:clone -a <app> ./my-app       # into a specific dir
heroku git:remote -a <app>               # add a `heroku` remote to an existing repo
heroku git:remote -a <app> -r staging    # add a remote named 'staging'
```

## Deploy via git push

```bash
git push heroku main                # push current local main → builds + deploys
git push heroku main:master         # if your local branch is 'main' but Heroku uses 'master' (older stacks)
git push heroku somefeature:main    # push a feature branch to Heroku's main → deploys it
git push -f heroku main             # force push — rewrites Heroku's git history; rarely needed
```

A push triggers:
1. Heroku receives the push.
2. Buildpacks/CNBs detect the language and build a slug or OCI image.
3. A `release` Procfile line (if any) runs.
4. New dynos start with the new release; old ones stop.

If the build fails, the push is rejected and the app keeps running the previous release.

## Multiple apps (staging + production)

```bash
heroku git:remote -a my-app-staging -r staging
heroku git:remote -a my-app-prod -r prod
git push staging main        # deploy to staging
git push prod main           # deploy to prod
```

Always use explicit remote names (`-r`) when you have multiple apps in one repo — `git push heroku main` is ambiguous and dangerous.

## When NOT to use git push

- For stateful builds (config baked into slug), use `git push` (not pipeline promotion) — see the `pipelines` skill.
- For pre-built Docker images, use `heroku container:push && container:release` (see the `container` skill).
- For pipeline promotion between stages, use `heroku pipelines:promote` (see the `pipelines` skill).

## Pitfalls

- Pushing a force-updated branch triggers a rebuild. Force-pushes to Heroku are almost always wrong.
- The default branch on Heroku is `main` (was `master` on older stacks). Mismatched branch names are a common first-deploy failure.
- A large push (huge binary blobs in git history) makes every build slow. Use `.slugignore` and don't commit binaries.
- The Heroku git endpoint is for deploys, not general-purpose git hosting. Don't use `heroku git:clone` as your primary source of truth — keep your real repo on GitHub/GitLab.

---

### `skills/local/SKILL.md`

```yaml
---
name: heroku-local
description: Run your Heroku app locally with `heroku local` — Procfile, env files, port overrides, process selection.
---
```

# Heroku local (`heroku local`)

Runs your Procfile-defined processes locally using the same env-var and process model as Heroku dynos. Useful for parity testing before deploy.

## Commands

```bash
heroku local                              # run all Procfile process types
heroku local web                          # only web
heroku local web=2                        # 2 web processes
heroku local web=1,worker=2               # mix + scale
heroku local -e .env.staging              # use a different env file (default: .env)
heroku local -f Procfile.dev              # different Procfile
heroku local -p 4000                      # override the port (also sets $PORT for the process)
heroku local --start-cmd "node server.js" # web command when no Procfile present

heroku local:start                        # alias of `heroku local`
```

## Env files

`.env` in the project root is loaded automatically. Lines are `KEY=value`. Comments start with `#`. The local env file is the right place for development secrets — **don't commit it**.

```bash
# .env example
DATABASE_URL=postgres://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
PORT=5000
```

## Procfile format

```
web: node server.js
worker: node worker.js
release: node scripts/migrate.js
clock: node clock.js
```

Each line is `<type>: <command>`. `web` is special (gets `$PORT` and HTTP routing on Heroku). `release` is the release-phase command. Other types are background workers/clocks/schedulers.

## Pitfalls

- `heroku local` doesn't provision add-ons. Local Postgres/Redis/etc. is your responsibility — use Docker or local installs.
- Port conflicts: only one process can listen on `$PORT`. If you run `web=2`, the second `web` will fail unless your code reads `PORT` and adds an offset.
- `.env` values override shell env. To prevent that, use `heroku local -e /dev/null`.
- `heroku local` is not a production server. Don't run it as a daemon in prod.

---

### `skills/logs/SKILL.md`

```yaml
---
name: heroku-logs
description: View Heroku app logs and manage log drains with `heroku logs` and `heroku drains` — tail, source filter, syslog/HTTPS drains.
---
```

# Heroku logs & drains (`heroku logs`, `heroku drains`)

## Reading logs

```bash
heroku logs -a <app>                       # last ~100 lines
heroku logs -a <app> --tail                # live tail
heroku logs -a <app> -n 500                # last 500 lines
heroku logs -a <app> --source app          # filter by source: app | router | run | api | dyno
heroku logs -a <app> --ps web              # filter by process type / dyno name
heroku logs -a <app> --tail --ps web.1
```

Sources:
- `app` — stdout/stderr from your code.
- `router` — Heroku's HTTP router (request lines, H12 timeouts, 503s).
- `dyno` — dyno lifecycle events (start, stop, crash, restart).
- `run` — one-off `heroku run` dynos.
- `api` — Heroku Platform API actions against this app.

Log lines have a syslog-like format: `timestamp source[dyno]: message`. The CLI's `--tail` uses a Logplex session that stays open for ~1000s by default; long-running tails need a drain instead.

## Log drains (persistent)

For long-term storage / search, add a drain to a syslog or HTTPS endpoint:

```bash
heroku drains -a <app>                       # list drains
heroku drains:add syslog+tls://logs.example.com:1234 -a <app>
heroku drains:add https://user:pass@log-host.com/incoming -a <app> --filter source=app
heroku drains:remove <drain-url-or-id> -a <app>
```

HTTPS drains receive POSTs with a syslog-formatted body. Syslog drains support `syslog://`, `syslog+tcp://`, `syslog+tls://`, `syslog+udp://`. TLS is strongly recommended.

`--filter` narrows what's sent (e.g. `source=app`, `dyno=web.1`). Useful for sending only app logs to an APM and router logs to an alerting system.

## Spaces & telemetry

- For Private Space apps, see `spaces:drains` for space-level drains.
- OpenTelemetry-style metrics/traces go via `heroku telemetry` drains (OTLP) — see the `telemetry` skill. Telemetry drains are separate from log drains.

## Common log lines to recognize

| Code | Meaning |
| --- | --- |
| `H10` | App crashed — check `app` source for the stack trace |
| `H12` | Request timeout (30s) — slow endpoint or long-running sync work |
| `H13` | Connection closed without response — app died mid-request |
| `H14` | No web dynos running — `ps:scale web=1` |
| `H27` | Client request interrupted |
| `R14` | Memory quota exceeded — bigger dyno or fix the leak |
| `R15` | Memory quota exceeded (busy) — fix the leak; bigger dyno only delays |
| `M11` | SIGTERM received — graceful shutdown window (30s) |
| `L10` | Logplex drain delivery failure |

## Pitfalls

- The CLI's `--tail` is a short-lived session. For 24/7 monitoring, add a drain.
- `logs -n N` caps at the Logplex retention (~1500 lines on standard, more on higher tiers). Old logs are gone.
- HTTPS drains must respond `200` quickly or Logplex backs off. Don't do heavy processing inline.
- Filter by `--source router` to diagnose 5xx and timeouts that aren't visible in app logs.

---

### `skills/maintenance/SKILL.md`

```yaml
---
name: heroku-maintenance
description: Toggle Heroku app maintenance mode with `heroku maintenance` — on/off, when to use, user-visible behavior.
---
```

# Heroku maintenance mode (`heroku maintenance`)

Puts up a "app under maintenance" page and stops serving HTTP from web dynos. Worker/scheduler dynos keep running. Useful for migrations or major config changes.

## Commands

```bash
heroku maintenance -a <app>                   # current status
heroku maintenance:on -a <app>                # DESTRUCTIVE-ish — see safety rule
heroku maintenance:off -a <app>
```

## Behavior

- Web dynos keep running but Heroku's router returns a 503 with a maintenance page to all HTTP requests.
- Non-web process types (worker, scheduler) are unaffected.
- One-off `heroku run` dynos still work.
- The default maintenance page is generic. Customization is via the `MAINTENANCE_PAGE_URL` or a custom error page in your app — check current Dev Center.

## When to use

- Running a non-additive DB migration that would crash the running app.
- Doing a large config-var change you want atomic.
- Migrating data into a fresh add-on.

The pattern:

```bash
heroku maintenance:on -a $APP
heroku run rails db:migrate -a $APP --exit-code
heroku maintenance:off -a $APP
```

## Pitfalls

- `maintenance:on` is a 503 to all users. Don't leave it on; set a reminder.
- Worker dynos keep running, so background jobs that hit the DB will continue. If your migration breaks workers, scale them to 0 first: `heroku ps:scale worker=0 -a $APP`.
- Health checks (UptimeRobot, etc.) will fire 503 alerts. Schedule a maintenance window in your monitor.

---

### `skills/orgs/SKILL.md`

```yaml
---
name: heroku-orgs
description: Manage Heroku teams/orgs with `heroku orgs` and `heroku members` — list teams, members, roles, invitations, enterprise teams.
---
```

# Heroku teams & orgs (`heroku orgs`, `heroku members`)

Heroku groups apps and people under **teams** (also called orgs in older docs). Enterprise accounts add a layer above teams.

## Teams

```bash
heroku orgs                                   # teams you're in
heroku orgs --enterprise                      # enterprise teams only
heroku orgs --json
heroku orgs:open -t <team>                    # dashboard
```

## Members

```bash
heroku members -t <team>                      # list members + roles
heroku members -t <team> --json
heroku members -t <team> --pending            # pending invitations
heroku members -t <team> --role admin         # filter by role

heroku members:add user@example.com -t <team> --role admin
heroku members:set user@example.com -t <team> --role member
heroku members:remove user@example.com -t <team>    # DESTRUCTIVE — see safety rule
```

Common roles: `admin` (manage team + billing), `member` (create apps in team), `viewer` (read-only), `billing_admin` (manage billing only). Enterprise teams may add `identity_provider`-managed roles.

## Pitfalls

- Removing a member removes their access to **all** team apps at once. Confirm before bulk operations.
- Invitations expire. Re-send by removing and re-adding the pending member.
- Enterprise accounts manage team membership via SAML IdP in many cases; CLI `members:*` may be read-only or restricted. Check with the enterprise admin.

---

### `skills/pipelines/SKILL.md`

```yaml
---
name: heroku-pipelines
description: Manage Heroku Pipelines with `heroku pipelines` — create, add/remove apps, connect to GitHub, promote, diff, info, open, destroy, rename. Covers Cedar-vs-Fir constraint and stateful-build warning.
---
```

# Heroku Pipelines (`heroku pipelines`)

A pipeline groups apps that share a codebase across stages (e.g. review → staging → production). Promotion moves the **build artifact** (slug) between stages without rebuilding.

## Listing & info

```bash
heroku pipelines                            # pipelines you can see
heroku pipelines --json
heroku pipelines:info <pipeline>            # apps grouped by stage
heroku pipelines:open <pipeline>            # dashboard
```

## Create / wire

```bash
heroku pipelines:create <name> -a <app> --stage staging
heroku pipelines:add <pipeline> -a <app> --stage production
heroku pipelines:connect <pipeline> -r <github-org/repo>   # GitHub integration for review apps/CI
heroku pipelines:rename <old> <new>
heroku pipelines:remove -a <app>            # detach this app from its pipeline
heroku pipelines:destroy <pipeline> --confirm <pipeline>   # DESTRUCTIVE — see safety rule
```

`pipelines:create` takes one app + its stage; add more apps with `pipelines:add`. A pipeline can only contain apps from **one generation** — you cannot mix Cedar and Fir apps. Plan the generation up front.

## Promote

```bash
heroku pipelines:promote -a <staging-app>            # promote staging's latest slug to its downstream(s)
heroku pipelines:promote -a <staging-app> --to <prod-app>
heroku pipelines:diff -a <staging-app>               # compare staging slug vs downstream
```

Promotion moves the slug, not the code. Config vars, add-ons, and domains on the downstream app are **not** changed — manage those per-app.

**Stateful-build warning:** if your build compiles config-var values into the slug (e.g. asset pipeline that reads `SECRET_KEY_BASE` at build time), promotion can break the downstream app because the downstream's config vars differ from the build-time values. For stateful builds, use Git/GitHub deploys instead of pipeline promotion.

## Diff

```bash
heroku pipelines:diff -a <app>
```

Shows which commits and config vars differ between the app and its downstream. Run before promote to sanity-check.

## Review apps & CI

- `reviewapps:enable` / `reviewapps:disable` — turn on ephemeral PR apps (see the `reviewapps` skill).
- `heroku ci` — Heroku CI runs tests on every push to a GitHub-connected pipeline (see the `ci` skill).

## Pitfalls

- Cedar + Fir in one pipeline is unsupported. Check `apps:info` for the generation before adding an app.
- Promoting a stateful build breaks downstream apps. Use Git deploys for those.
- Promotion does not copy config/add-ons. Secrets, DB URLs, and feature flags must be set on each stage independently.
- `pipelines:destroy` does not delete the member apps — it only removes the pipeline grouping. Safe but disruptive (loses stage metadata and review-app config).

---

### `skills/platform-api/SKILL.md`

```yaml
---
name: heroku-platform-api
description: Use the Heroku Platform API directly — base URL, auth, Accept header, key endpoints (apps, formations, dynos, config-vars, releases, builds, addons, domains, pipelines, spaces), rate limits, schema discovery.
---
```

# Heroku Platform API

For bulk operations, automation, or anything the CLI doesn't expose, hit the Platform API directly. It's a REST/JSON API that the CLI itself wraps.

## Basics

- Base URL: `https://api.heroku.com`
- Required header: `Accept: application/vnd.heroku+json; version=3`
- Auth: `Authorization: Bearer <token>` where `<token>` is from `heroku auth:token` (CLI session) or `heroku authorizations:create` (long-lived), or via netrc (`curl -n`).
- Content type for writes: `Content-Type: application/json`
- Schema (machine-readable): `GET https://api.heroku.com/schema`

## curl patterns

```bash
# List apps (uses netrc creds from `heroku login`)
curl -n https://api.heroku.com/apps -H "Accept: application/vnd.heroku+json; version=3"

# Using an explicit API key
curl https://api.heroku.com/apps \
  -H "Accept: application/vnd.heroku+json; version=3" \
  -H "Authorization: Bearer $HEROKU_API_KEY"

# Create an app
curl -nX POST https://api.heroku.com/apps \
  -H "Accept: application/vnd.heroku+json; version=3" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","region":"us","stack":"heroku-24"}'

# Patch (rename)
curl -nX PATCH https://api.heroku.com/apps/my-app \
  -H "Accept: application/vnd.heroku+json; version=3" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app-v2"}'
```

## Key endpoints

| Resource | Method | Path |
| --- | --- | --- |
| Apps | GET / POST | `/apps` |
| App | GET / PATCH / DELETE | `/apps/{app_id_or_name}` |
| Dynos (list) | GET | `/apps/{app}/dynos` |
| One-off dyno | POST | `/apps/{app}/dynos` |
| Formation (list) | GET | `/apps/{app}/formation` |
| Formation (scale) | PATCH | `/apps/{app}/formation/{type}` with `{"quantity": N, "size": "standard-1x"}` |
| Config vars | GET / PATCH | `/apps/{app}/config-vars` |
| Releases | GET | `/apps/{app}/releases` |
| Release | GET | `/apps/{app}/releases/{release_id}` |
| Rollback | POST | `/apps/{app}/releases` with `{"release": {id: ...}}` (or use CLI `releases:rollback`) |
| Builds | GET / POST | `/apps/{app}/builds` |
| Add-ons (list) | GET | `/apps/{app}/addons` |
| Add-on (create) | POST | `/apps/{app}/addons` with `{"plan": "heroku-postgresql:essential-0"}` |
| Add-on (delete) | DELETE | `/apps/{app}/addons/{addon_id}` |
| Domains | GET / POST | `/apps/{app}/domains` |
| Pipelines | GET / POST | `/pipelines` |
| Pipeline promotion | POST | `/pipeline-promotions` |
| Spaces | GET / POST | `/spaces` |
| Space topology | GET | `/spaces/{space}/topology` |
| Log session (tail) | POST | `/apps/{app}/log-sessions` with `{"line": 1, "tail": true}` → returns a `logplex_url` to stream |
| Team apps | GET | `/teams/{team}/apps` |
| Team invoices | GET | `/teams/{team}/invoices` |

The full reference is in the Heroku Dev Center "Platform API Reference". Last updated Feb 2026.

## Scaling via the API (the right way)

`POST /apps/{app}/dynos/.../actions/stop` returns 200 but **does not stop a scaled dyno** — the platform restarts it. Scale down with the formation endpoint:

```bash
curl -nX PATCH https://api.heroku.com/apps/$APP/formation/web \
  -H "Accept: application/vnd.heroku+json; version=3" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 0}'
```

This is the canonical fix for "I scaled to 0 via the API but the dyno came back."

## Streaming logs via the API

```bash
curl -nX POST https://api.heroku.com/apps/$APP/log-sessions \
  -H "Accept: application/vnd.heroku+json; version=3" \
  -H "Content-Type: application/json" \
  -d '{"line": 1, "tail": true}' | jq -r .logplex_url
# then:
curl -N "$(above)"
```

The `logplex_url` is a temporary OTLP/logplex endpoint that streams log lines.

## Rate limits

- Default: ~2500 requests/hour per token (confirm against current Dev Center).
- Response headers `RateLimit-Remaining` and `RateLimit-Reset` tell you when you'll be throttled.
- For bulk operations, batch where possible (e.g. one `PATCH /formation` per type, not one per dyno) and back off on 429.

## Schema (generate a client)

```bash
curl https://api.heroku.com/schema -H "Accept: application/vnd.heroku+json; version=3" > heroku-schema.json
```

Existing community clients: `platform-api` (Ruby), `node-heroku-client` (Node), `heroku-go` (Go), `Heroku.scala`.

## When to prefer the API over the CLI

- Bulk operations across many apps (e.g. list all dynos in a team).
- Embedding Heroku operations in a larger script where shell-quoting `heroku` output is fragile.
- Anything not exposed by the CLI (e.g. some team-invoice endpoints).
- When you need a stable, parseable contract.

When the CLI suffices, prefer it — it handles auth, pagination, and output formatting for you.

---

### `skills/postgres/SKILL.md`

```yaml
---
name: heroku-postgres
description: Manage Heroku Postgres with `heroku pg` — info, credentials, settings, backups (capture/restore/schedule), connection pooling, followers, links, diagnose, outliers, copy, upgrade, kill. Includes the ≤20GB backup rule and pg:reset danger.
---
```

# Heroku Postgres (`heroku pg`)

Managed PostgreSQL. Provisioned as an add-on (`heroku-postgresql:<plan>`), exposes `DATABASE_URL` (or `<ALIAS>_URL` if attached with `--as`). The `pg` topic has dozens of subcommands — only the operationally important ones are here. Run `heroku pg --help` locally for the full list.

## Inspect

```bash
heroku pg -a <app>                         # summary of all DBs on the app
heroku pg:info -a <app>                    # primary DB info (plan, version, state, connections, size)
heroku pg:info HEROKU_POSTGRESQL_VIOLET -a <app>   # specific attachment
heroku pg:credentials -a <app>             # list credentials
heroku pg:credentials DATABASE -a <app>    # a specific credential's connection info
heroku pg:settings -a <app>                # current DB settings
heroku pg:extensions -a <app>              # installed + available extensions
```

`pg:credentials` output includes the connection string — **treat as a secret**, don't paste back in full (safety rule).

## Backups

```bash
heroku pg:backups -a <app>                           # list
heroku pg:backups:capture -a <app>                   # take a manual backup
heroku pg:backups:capture DATABASE -a <app> --verify
heroku pg:backups:info b001 -a <app>                 # status of a specific backup
heroku pg:backups:download b001 -a <app>             # download to ./latest.dump
heroku pg:backups:restore b001 -a <app> --confirm <app>   # DESTRUCTIVE — overwrites DATABASE_URL target
heroku pg:backups:restore <other-app>::b001 -a <app>      # restore from another app's backup
heroku pg:backups:schedule --at "02:00 America/New_York" -a <app>   # daily scheduled
heroku pg:backups:unschedule -a <app>
heroku pg:backups:delete b001 -a <app>
```

**The ≤20 GB rule:** `pg:backups:capture` is the right tool for DBs up to ~20 GB. For larger databases, performance degrades and the capture can fail. The recommended path is:

1. Fork the primary DB: `heroku addons:create heroku-postgresql:<plan> --follow DATABASE -a <app>`
2. Wait for the fork to catch up (`pg:info`).
3. Take a logical backup from the fork using `pg_dump` inside a one-off dyno:

   ```bash
   heroku pg:psql -a <app> -c "SELECT pg_switch_wal();"   # force WAL switch on fork
   heroku run bash -a <app> --size performance-l
   # inside the dyno:
   pg_dump $(pg:credentials DATABASE --raw -a <app> ...)  # or use the fork's URL
   ```

4. Restore with `pg_restore --no-acl --no-owner -d <target-url> latest.dump`. The `--no-acl --no-owner` flags are essential for cross-DB restores where roles differ.

`pg:backups:restore` is destructive on the target — it overwrites whatever's at `DATABASE_URL` (or the named target). Always `--confirm <app>` and double-check the target.

## Connection pooling

```bash
heroku pg:connection-pooling -a <app>                       # pooler attachment info
heroku pg:connection-pooling:attach DATABASE -a <app> --as POOLER
```

The pooler exposes a separate `<ALIAS>_URL` (e.g. `POOLER_URL`) on port 5432 with PgBouncer transaction-mode pooling. Use it for apps that open many short-lived connections (e.g. per-request DB connections in serverless-ish dynos). Don't use the pooler for sessions, prepared statements, or LISTEN/NOTIFY.

## Followers

```bash
heroku addons:create heroku-postgresql:<plan> --follow DATABASE -a <app>
heroku pg:info -a <app>             # shows follower lag
heroku pg:promote HEROKU_POSTGRESQL_VIOLET -a <app>   # DESTRUCTIVE-ish — makes follower the new primary
```

`pg:promote` swaps which attachment is `DATABASE_URL`. Old primary becomes a follower of the new one. Use for zero-downtime version upgrades and failover. Confirm with the user before promoting.

## Performance & diagnostics

```bash
heroku pg:diagnose -a <app>                     # runs Heroku's diagnostic report
heroku pg:outliers -a <app>                     # 10 slowest queries by total time
heroku pg:outliers -a <app> --reset             # reset pg_stat_statements counters
heroku pg:calls -a <app>                        # 10 most-executed queries
heroku pg:long-running-queries -a <app>
heroku pg:locks -a <app>
heroku pg:blocking -a <app>                     # queries holding locks others wait on
heroku pg:cache-hit -a <app>                    # index + table hit rate (target 99%+)
heroku pg:index-size -a <app>
heroku pg:index-usage -a <app>
heroku pg:bloat -a <app>                        # table + index bloat
heroku pg:statements:run <sql> -a <app>         # (where available) run read-only SQL
```

`pg:psql` (or `heroku pg:psql -a <app>`) opens a psql session against `DATABASE_URL`.

## Settings

```bash
heroku pg:settings -a <app>
heroku pg:settings:log-min-duration-statement 100 -a <app>   # log queries > 100ms
heroku pg:settings:pooling-logs -a <app>
heroku pg:settings:pg-stat-statements-track all -a <app>
```

## Operations

```bash
heroku pg:kill <pid> -a <app>
heroku pg:killall -a <app>                     # terminates all connections
heroku pg:psql -a <app>                        # interactive psql
heroku pg:psql -c "SELECT 1;" -a <app>         # one-shot
heroku pg:copy <source-db> <target-db> -a <app> --confirm <app>   # DESTRUCTIVE — overwrites target
heroku pg:upgrade -a <app>                     # schedule in-place major version upgrade
heroku pg:upgrade:cancel -a <app>              # cancel scheduled upgrade (not one in progress)
heroku pg:wait -a <app>                        # wait for DB to be available
```

`pg:reset -a <app> --confirm <app>` drops all data — destructive, requires confirmation. Use `pg:copy` for cross-DB copies and `pg:backups:restore` for backup restores instead where possible.

## Links

`pg:links` connects one Postgres to another (e.g. for cross-database queries via postgres_fdw):

```bash
heroku pg:links -a <app>
heroku pg:links:create <source> <target> -a <app>
heroku pg:links:destroy <link> -a <app>
```

## Pitfalls

- `pg:backups:capture` on a >20 GB DB is slow and may fail — fork + `pg_dump` instead.
- `pg:backups:restore` overwrites the target DB. Confirm the target attachment name twice.
- `pg:promote` is irreversible without another promote. Plan the cut-over first.
- Pooler connections are transaction-mode — don't use them for session-level features.
- `pg:killall` drops all app connections mid-request. Use only during maintenance.

---

### `skills/redis/SKILL.md`

```yaml
---
name: heroku-redis
description: Manage Heroku Data for Redis with `heroku redis` — info, cli, credentials, promote, maxmemory policy, timeout, keyspace notifications, upgrade, wait.
---
```

# Heroku Data for Redis (`heroku redis`)

Managed Redis-compatible key/value store. Provisioned as `heroku-redis:<plan>`, exposes `REDIS_URL` (or `<ALIAS>_URL` if attached with `--as`).

## Inspect

```bash
heroku redis -a <app>                       # summary of all Redis instances
heroku redis:info -a <app>                  # plan, version, status, memory, evicted keys
heroku redis:info HEROKU_REDIS_RED -a <app>
heroku redis:info -a <app> --json
heroku redis:credentials -a <app>           # connection info — treat as secret
heroku redis:wait -a <app>                  # wait for instance to be available
```

## Interactive / one-shot commands

```bash
heroku redis:cli -a <app>                   # interactive redis-cli session
heroku redis:cli -a <app> -- -c "INFO memory"
heroku redis:cli DATABASE -a <app>          # specific attachment
```

## Promote

```bash
heroku redis:promote HEROKU_REDIS_RED -a <app>
```

Sets the named attachment as `REDIS_URL` (the others keep their own `<ALIAS>_URL`). Used for failover to a follower. Confirm before promoting — the previous primary keeps serving traffic on its own URL until apps reconnect.

## Configuration

```bash
heroku redis:maxmemory <policy> -a <app>          # policy: noeviction | allkeys-lru | volatile-lru | ...
heroku redis:timeout <seconds> -a <app>           # idle connection timeout
heroku redis:keyspace-notifications <flags> -a <app>  # KEA / Exg etc.
```

`maxmemory` policy defaults to `noeviction` on Heroku — writes start failing when memory is full. For cache workloads switch to `allkeys-lru`. The `info` command shows current `evicted_keys` — if non-zero and you're on `noeviction`, you're failing writes.

`keyspace-notifications` takes the standard Redis flags string (e.g. `KEA` for everything, `Ex` for expired events on keyspace).

## Upgrade

```bash
heroku redis:upgrade -a <app>               # in-place version upgrade
heroku redis:upgrade HEROKU_REDIS_RED -a <app>
```

Online but causes brief latency spikes. Schedule outside peak. Check `redis:info` for `version` and `status: available` before/after.

## Stats

```bash
heroku redis:stats-reset -a <app>           # CONFIG RESETSTAT — clears counters
```

## Pitfalls

- `noeviction` default: writes fail when out of memory. Pick the right policy for your workload.
- Don't use Redis for durable primary data — use Postgres. Redis is for cache/queues/sessions.
- `redis:promote` does not migrate in-flight connections. Restart workers after promote (`heroku ps:restart worker -a <app>`).
- Mini plans are single-tenant-ish and have connection limits; high-concurrency apps should upgrade.

---

### `skills/releases/SKILL.md`

```yaml
---
name: heroku-releases
description: Manage Heroku releases with `heroku releases` — list, info, output, retry, rollback. Covers release-phase commands and rollback safety.
---
```

# Heroku releases (`heroku releases`)

A **release** is a deployed version of the app: slug + config vars + add-ons state. Every `git push`, `config:set`, `addons:create`, etc. creates a new release. Releases are numbered (`v1`, `v2`, …) and listed newest-first.

## Listing & info

```bash
heroku releases -a <app>                       # recent releases
heroku releases -a <app> -n 50                 # last 50
heroku releases -a <app> --json
heroku releases:info v42 -a <app>
heroku releases:info v42 -a <app> --json
heroku releases:output v42 -a <app>            # release-phase command output (if any)
```

## Release-phase commands

If your `Procfile` has a `release` line, Heroku runs it before the new dynos start:

```
release: ./bin/migrate
```

`releases:output` shows that command's stdout/stderr. `releases:retry` re-runs it without creating a new release:

```bash
heroku releases:retry -a <app>                  # retry the latest release-phase command
heroku releases:retry v42 -a <app>
```

Retry is useful when a `release` command failed transiently (e.g. DB briefly unreachable). If the migration itself is broken, fix the code and deploy again rather than retrying.

## Rollback

```bash
heroku releases:rollback v40 -a <app>           # DESTRUCTIVE — see safety rule
heroku releases:rollback -a <app>               # rollback to the previous release
```

Rollback creates a **new** release (`v(N+1)`) whose slug+config match `v40`. It does not delete later releases — they're still in the list and you can roll forward by deploying again.

**Rollback is dangerous for stateful migrations:**
- If `v41` ran a forward migration (`ALTER TABLE … ADD COLUMN`), rolling back to `v40` runs the older code against the already-migrated schema. Often OK for additive migrations, fatal for destructive ones (`DROP COLUMN`, type changes).
- Always pair rollback with a DB check: `heroku pg:info -a <app>` and inspect the schema before allowing traffic back.
- For risky rollbacks, prefer: scale web to 0 → rollback → run a verification one-off dyno → scale web back up.

## Pitfalls

- Rollback does not undo config-var changes made by `config:set` since `v40` — it restores the slug and the **config as of v40**, which is usually what you want, but be aware that any add-on attachment changes since `v40` are not reverted.
- `releases:output` is only meaningful for releases that had a `release` Procfile line.
- Rollback on a Private Space app uses rolling deploys — there's a brief mix of old/new dynos.
- Releasing more than ~N times (depends on plan) in rapid succession can hit Platform API rate limits. Don't script tight deploy loops.

---

### `skills/reviewapps/SKILL.md`

```yaml
---
name: heroku-reviewapps
description: Enable/disable Heroku Review Apps on a pipeline with `heroku reviewapps` — PR-driven ephemeral apps via app.json. Covers cost and cleanup.
---
```

# Heroku Review Apps (`heroku reviewapps`)

Review apps are ephemeral Heroku apps created automatically for each pull request on a GitHub-connected pipeline. They're destroyed when the PR is closed (orphan handling configurable). Great for previewing UI/behavior; **billed like normal apps**.

## Enable / disable

```bash
heroku reviewapps:enable -p <pipeline> -a <parent-app> --app <parent> --autobuild --autodestroy
heroku reviewapps:disable -p <pipeline>          # turns off review apps (existing ones stay until PR closed)
heroku reviewapps:disable -p <pipeline> --no-autodestroy   # keep review apps after PR close
```

Flags worth knowing:
- `--autobuild` — build on every PR push (default when enabling).
- `--autodestroy` — destroy the review app when the PR closes.
- `--no-autodestroy` — keep review apps after PR close (you clean up manually).

## How they're built

A review app is created from `app.json` in the repo root at the PR's HEAD. `app.json` declares:

- `name` (or `repository` for a fork)
- `stack`, `buildpacks`
- `env` — initial config vars (string literals or `{ "value": "...", "required": true }`)
- `addons` — list of `heroku-postgresql:essential-0` etc. to provision
- `scripts` — `postdeploy` hook (e.g. `node scripts/seed.js`)

A common pattern: `postdeploy` runs migrations + seed against the freshly-provisioned review DB.

## Listing / inspecting

Review apps show up in `heroku apps` with names like `<pipeline>-pr-<n>` (the exact pattern depends on the pipeline). `heroku pipelines:info <pipeline>` shows them grouped under a `review` stage.

## Cost & cleanup

- Dynos and add-ons in review apps are **billed like normal apps** — Eco dynos help here.
- `--autodestroy` is the default and recommended. Without it, review apps accumulate.
- For idle pipelines, `reviewapps:disable` until needed.
- Use `heroku ps:scale web=0 -a <review-app>` to pause a review app without destroying it (still pays for any attached DBs).

## Pitfalls

- `app.json` addon plans must exist on the current stack/generation. A `hobby-dev` Postgres entry from an old repo will fail on a Cedar-24 stack.
- Review apps inherit the pipeline's generation. A Cedar pipeline won't get Fir review apps.
- `postdeploy` scripts run with the review app's config vars — make sure they read `DATABASE_URL` dynamically, not a hardcoded value.
- Orphaned review apps (PR force-pushed/closed before destroy) can be cleaned up with `apps:destroy --confirm <name>`.

---

### `skills/run/SKILL.md`

```yaml
---
name: heroku-run
description: Run one-off processes inside Heroku dynos with `heroku run` — bash, scripts, migrations, rake tasks. Covers --exit-code, --type, env passing, no-tty for piping, and per-second billing.
---
```

# Heroku one-off dynos (`heroku run`)

`heroku run` spawns a one-off dyno with your code and config vars, runs a command, and streams output back. Used for migrations, rake/python manage.py tasks, shells, one-off scripts.

## Basic

```bash
heroku run bash -a <app>                       # interactive shell
heroku run rails db:migrate -a <app>
heroku run python manage.py shell -a <app>
heroku run "node scripts/seed.js" -a <app>
heroku run worker -a <app>                     # run the 'worker' Procfile type as a one-off
```

## Flags

```bash
heroku run bash -a <app> --exit-code           # propagate the command's exit code (non-interactive)
heroku run bash -a <app> --no-tty              # force no TTY (for piping output)
heroku run rails db:migrate -a <app> --size performance-l   # bigger dyno for this one-off
heroku run rails db:migrate -a <app> --type run            # use the 'run' formation type
heroku run bash -a <app> -e FOO=bar -e BAZ=qux             # extra env (use ';' for multiple)
heroku run bash -a <app> --no-notify                       # suppress "dyno is up" notification
heroku run bash -a <app> --no-launcher                      # don't prepend 'launcher' (CNB apps)
```

`--exit-code` is essential for scripted one-offs (migrations in CI/CD): without it, `heroku run` always exits 0 if the connection succeeded, masking command failures.

## Patterns

```bash
# Migration that fails the deploy if it fails
heroku run rails db:migrate -a $APP --exit-code || exit 1

# Pull DB credentials into a one-off without echoing them
heroku run bash -a $APP << 'EOF'
  psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
EOF

# Pipe a file into a remote command
cat data.csv | heroku run "psql \$DATABASE_URL -c 'COPY users FROM stdin CSV HEADER'" -a $APP --no-tty
```

## Billing & lifecycle

- One-off dynos are billed **per second** of runtime.
- Interactive `heroku run bash` keeps the dyno alive until you `exit`. Don't walk away.
- One-off dynos are killed after 24h (Cedar) or the dyno's max lifetime (Fir). Don't use them as long-running workers — define a `worker` process type and scale it.
- One-off dynos show up in `heroku ps -a <app>` as `run.N`.

## Pitfalls

- `heroku run rails db:migrate` with interactive prompts hangs in CI. Use `--no-tty` and `--exit-code` for automation.
- A one-off dyno has the same config vars as the formation, including `DATABASE_URL`. Don't pass DB URLs as args.
- `--size performance-l` for a 5-second migration is wasteful but for a 30-minute data backfill it's worth it (faster → cheaper).
- `heroku run` on a Private Space app may need `--no-tty` depending on your SSH config.
- "Launcher" prefix: on CNB (Fir) apps, Heroku prepends `launcher` to set up the runtime. Use `--no-launcher` only if you know your image handles entry itself.

---

### `skills/spaces/SKILL.md`

```yaml
---
name: heroku-spaces
description: Manage Heroku Private/Shield Spaces with `heroku spaces` — create, destroy, info, topology, rename, transfer, dynos, peerings, trusted IPs, VPN, drains.
---
```

# Heroku Private Spaces (`heroku spaces`)

A **Private Space** is an isolated Heroku runtime in a single region on dedicated infrastructure. **Shield Spaces** add HIPAA compliance. Apps in a space get network isolation from the Common Runtime; dynos run on `private-*` (Private) or `shield-*` (Shield) sizes.

## Listing & info

```bash
heroku spaces                                 # your spaces
heroku spaces --json
heroku spaces -t <team>
heroku spaces:info <space>
heroku spaces:topology <space>                # network topology diagram data
heroku spaces:ps -a <app-in-space>            # dynos across the space (by app)
```

## Create / destroy / rename / transfer

```bash
heroku spaces:create <name> --team <team> --region <region>
heroku spaces:create <name> --team <team> --region <region> --shield      # Shield Space (HIPAA)
heroku spaces:rename <old> <new>
heroku spaces:transfer <space> --team <new-team>
heroku spaces:destroy <space> --confirm <space>     # DESTRUCTIVE — see safety rule
```

Destroying a space destroys every app and add-on in it. Always `--confirm <space>` and double-check.

## Networking

```bash
heroku spaces:peerings <space>                # VPC peering connections
heroku spaces:peerings:create <space> --account-id <aws-account> --cidr <cidr> --region <region>
heroku spaces:peerings:accept pcx-...         # accept a peering request (from the other side)

heroku spaces:trusted-ips <space>             # trusted IP ranges
heroku spaces:trusted-ips:add <space> --cidr 1.2.3.4/32
heroku spaces:trusted-ips:remove <space> --cidr 1.2.3.4/32

heroku spaces:vpn <space>                     # VPN connections
heroku spaces:vpn:configs <space>             # config to apply on your side
heroku spaces:vpn:create <space> --cidr 10.0.0.0/16 ...
heroku spaces:vpn:destroy <space> --name <vpn-name>

heroku spaces:drains <space>                  # space-level log drains (apply to all apps in space)
heroku spaces:drains:add syslog+tls://... -s <space>
heroku spaces:drains:remove <drain-id-or-url> -s <space>
```

## Dynos in a space

- Private/Shield dynos only run in Private/Shield Spaces. You can't put a Common Runtime dyno in a space.
- `heroku ps:stop` on a Private Space dyno terminates and replaces the dedicated instance (unlike Common Runtime, where scaled dynos restart).
- Private dynos support **rolling deploys** (zero-downtime) instead of preboot.
- Shield dynos have additional restrictions: no `ps:exec`, no internet egress by default, strict data egress controls.

## Pitfalls

- A space and its apps are pinned to one region. Cross-region failover requires a second space.
- CIDR ranges for peering/VPN must not overlap Heroku's internal ranges or your VPC. Plan ranges up front.
- `spaces:destroy` cascades. Always list apps first: `heroku apps -s <space>`.
- Shield spaces disable features that touch the public internet (e.g. ACM for some configurations). Plan certs manually.
- Trusted IPs apply to **inbound** requests to space apps; they don't restrict egress.

---

### `skills/telemetry/SKILL.md`

```yaml
---
name: heroku-telemetry
description: Manage Heroku telemetry drains with `heroku telemetry` — add, info, remove, update. OpenTelemetry-style OTLP metrics/traces/logs for Fir apps.
---
```

# Heroku telemetry drains (`heroku telemetry`)

Telemetry drains export OpenTelemetry-format observability data (metrics, traces, logs) from your Heroku apps to an OTLP-compatible endpoint (Datadog, Honeycomb, Tempo, Grafana Cloud, etc.). Distinct from log drains (`heroku drains`) and space drains (`heroku spaces:drains`).

## Commands

```bash
heroku telemetry -a <app>                       # list drains (or -s <space>)
heroku telemetry:info <drain-id> -a <app>

heroku telemetry:add -a <app> \
  --url https://ingest.example.com/otlp \
  --header "Authorization: Bearer ${TOKEN}" \
  --signals metrics,traces,logs \
  --spaces my-space

heroku telemetry:update <drain-id> -a <app> --signals metrics,traces
heroku telemetry:remove <drain-id> -a <app>     # DESTRUCTIVE — see safety rule
```

## Flags worth knowing

- `--url` — OTLP HTTP endpoint (gRPC is not supported by the CLI drain; use HTTP).
- `--header` — repeated; used for auth headers. Quote values that contain spaces or `$` expansions.
- `--signals` — `metrics`, `traces`, `logs`, or any combination (default: all).
- `--spaces` — apply the drain across a space (instead of per-app).

## When to use

- Fir-generation apps emit OTel by default; you need a drain to actually send the data anywhere.
- Cedar apps may have limited telemetry; check the current Dev Center for what's emitted.

## Pitfalls

- Telemetry drains and log drains are separate — both can send "logs", but log drains get syslog-formatted text and telemetry drains get OTLP log records.
- Don't put bearer tokens in the URL. Use `--header`.
- Removing a drain stops data flow silently. Confirm before removing in production.
- Some OTLP endpoints need `/v1/metrics`, `/v1/traces`, `/v1/logs` path suffixes; check the vendor's docs and include them in `--url` if required.

---

### `skills/usage/SKILL.md`

```yaml
---
name: heroku-usage
description: Inspect Heroku add-on usage with `heroku usage` — per-team metered add-on usage for cost investigation.
---
```

# Heroku usage (`heroku usage`)

For metered add-ons (e.g. Apache Kafka on Heroku, Confluent, some search/log add-ons), `heroku usage` reports consumption. Useful for cost investigations and budget alerts.

## Commands

```bash
heroku usage:addons -t <team>                       # metered add-on usage across a team
heroku usage:addons -t <team> --json
heroku usage:addons -t <team> --start 2026-01-01 --end 2026-02-01
heroku usage:addons -a <app>                        # single app
```

Output typically includes the add-on, plan, meters (requests, GB-hours, etc.), and the quantity consumed in the window.

## What's not here

- Dyno-hour usage is **not** in `heroku usage`. Dyno costs come from formation size × quantity × time. Estimate with `heroku ps -a <app>` + plan prices, or check the Heroku dashboard billing page.
- Team invoice line items are in the dashboard; there's no first-class CLI command for invoice download in the standard topic set.

## For cost investigation

A typical cost triage:

1. `heroku apps -A` → list all apps across the team.
2. For each app: `heroku ps -a <app> --json` and `heroku addons -a <app> --json`.
3. Sum dyno cost (size × qty × hourly) and add-on plan prices.
4. `heroku usage:addons -t <team> --json` for metered overages.

Or, faster, use the Platform API `/teams/{team_id}/invoice` and `/teams/{team_id}/monthly-usage` endpoints (see the `platform-api` skill).

## Pitfalls

- Metered add-ons can bill shockingly fast if a script loops calls. Set Heroku's built-in spend alerts in the dashboard.
- `usage:addons` windows are inclusive of start, exclusive of end (confirm with current docs).
- Eco dyno hours are a shared pool; one app can exhaust the pool for all your Eco apps. Check the dashboard's Eco usage panel.

---

### `skills/webhooks/SKILL.md`

```yaml
---
name: heroku-webhooks
description: Manage Heroku app webhooks with `heroku webhooks` — add, remove, update, info, deliveries, events. Covers webhook payload verification.
---
```

# Heroku app webhooks (`heroku webhooks`)

Heroku emits events for app lifecycle (deploy, dyno crash, add-on change, etc.) and delivers them to your HTTPS endpoints. Useful for Slack alerts, audit pipelines, custom autoscalers.

## Commands

```bash
heroku webhooks -a <app>                          # list webhooks
heroku webhooks:add -a <app> --url https://example.com/hook --include api:release --include dyno:crash
heroku webhooks:info <webhook-id> -a <app>
heroku webhooks:update <webhook-id> -a <app> --include api:release
heroku webhooks:remove <webhook-id> -a <app>      # DESTRUCTIVE — see safety rule

heroku webhooks:deliveries -a <app>               # delivery history
heroku webhooks:deliveries <delivery-id> -a <app> --json
heroku webhooks:events -a <app>                   # event history
heroku webhooks:events <event-id> -a <app>
```

## Setup

```bash
heroku webhooks:add -a my-app \
  --url https://example.com/heroku-webhook \
  --include api:release \
  --include dyno:crash \
  --secret "$(openssl rand -hex 32)"
```

The `--secret` is used to sign payloads (HMAC SHA-256) in the `Heroku-Webhook-Hmac-SHA256` header. **Verify it on your end** — don't trust unverified webhooks.

## Event categories

- `api:release` — new release created
- `api:build` — build started/finished
- `dyno:crash` — dyno crashed
- `addon:*` — add-on provisioned/deprovisioned/changed
- `app:*` — app-level events

`--include` can be `category:event` or just `category` (all events in that category).

## Pitfalls

- Heroku retries failed deliveries a few times then drops. Inspect `webhooks:deliveries` for `failed` status.
- Always set a `--secret` and verify HMAC. Unverified webhooks are an attack vector.
- Your endpoint must respond `2xx` quickly (a few seconds) or Heroku backs off. Do work async.
- The webhook payload format is JSON; see the Dev Center "App Webhooks" reference for the full schema.

---

## rules

### `rules/heroku-cli.mdc`

```yaml
---
description: Proactively use the locally-installed `heroku` CLI for inspecting and operating Heroku resources. Prefer --json output when parsing; never scrape the dashboard.
alwaysApply: true
globs:
---
```

# Heroku CLI awareness

The user has the Heroku CLI installed locally (`heroku`, built on oclif). Use it as the primary interface to Heroku — it is faster, scriptable, and more authoritative than the web dashboard.

## When to use it

Use `heroku` proactively whenever the user's request touches:

- Apps, dynos, formations, releases, builds, slugs
- Add-ons (Postgres, Redis, Kafka, search, email, monitoring, …)
- Pipelines, review apps, Heroku CI
- Domains, certs, ACM, SNI endpoints
- Config vars, buildpacks, Procfile-driven processes
- Private/Shield spaces, peerings, trusted IPs, VPN
- Teams, members, collaborators, OAuth authorizations/sessions
- Logs, log drains, telemetry drains, webhooks
- One-off dynos (`heroku run`) and local emulation (`heroku local`)

## How to call it

- Run read-only inspection commands freely: `heroku apps`, `heroku ps -a <app> --json`, `heroku pg:info -a <app>`, `heroku releases -a <app>`, `heroku addons -a <app> --json`, etc.
- Prefer `--json` whenever you'll parse the output programmatically. It is stable across terminal width/styling changes; plain table output is not.
- Prefer explicit `--app <name>` even inside a Git clone — auto-discovery from the `heroku` remote is convenient for humans but fragile for an agent that may have `cd`'d somewhere unexpected. If `--app` is omitted, first run `heroku git:remote -a <app>` or confirm the discovered app name with the user.
- For paginated or scripted work, prefer the Platform API (see the `platform-api` skill) over shelling out repeatedly. The CLI is fine for one-offs; the API is better for bulk operations.
- `heroku help <topic>` and `heroku <topic> --help` are the authoritative source for flag syntax on this machine. Run them when unsure whether a flag exists locally.

## What NOT to do

- Do not log in on the user's behalf. `heroku login` is interactive and browser-based; if the session is invalid, tell the user to run it themselves and re-invoke you.
- Do not store or print long-lived API tokens. If you need a token for a script, read it from `HEROKU_API_KEY` or `heroku auth:token` at runtime and never echo it back in chat.
- Do not scrape `dashboard.heroku.com` HTML. Use the CLI or Platform API.
- Do not invent plan names, dyno sizes, or prices. They drift — confirm against the Dev Center or `heroku addons:plans <service>` / `heroku ps:type` output before quoting them.

## Output conventions

When summarising CLI output for the user, prefer compact tables or bullet lists. Always include the app name(s) acted upon, the dyno type(s) if relevant, and the resulting state. If a command failed, include the exact stderr line.

---

### `rules/heroku-safety.mdc`

```yaml
---
description: Destructive Heroku operations require explicit user confirmation and an explicit --app. Never run them against an auto-discovered app without confirming the name first.
alwaysApply: true
globs:
---
```

# Heroku safety

Heroku operations can be irreversible and billable. Apply this rule to every command that mutates state or spends money.

## Destructive / irreversible commands — require explicit confirmation

Treat the following as destructive. Before running them, show the user the exact command you intend to run and the target `--app`, and wait for explicit confirmation (a "yes", "go ahead", or approval card). Do not infer consent from a prior message.

- `heroku apps:destroy -a <app> [--confirm <app>]` — deletes the app and all add-ons.
- `heroku addons:destroy <addon> -a <app> --confirm` — permanently destroys an add-on resource (data loss for DB add-ons).
- `heroku pg:reset -a <app> [DATABASE] --confirm <app>` — drops all data in the Postgres database.
- `heroku releases:rollback <release> -a <app>` — rolls back to an earlier release; can break stateful migrations.
- `heroku config:unset <VAR> -a <app>` — removes env vars; can break a running app.
- `heroku ps:scale <type>=0 -a <app>` — stops a process type; combined with `ps:stop` confusion, can take production offline.
- `heroku ps:kill <dyno> -a <app>` and `heroku ps:stop <type> -a <app>` — restarts scaled dynos; only meaningful for one-off/Private Space dynos.
- `heroku container:rm <type> -a <app>` — removes a process type's image.
- `heroku spaces:destroy <space> --confirm <space>` — destroys a Private/Shield space and everything in it.
- `heroku pipelines:destroy <pipeline> --confirm <pipeline>` — destroys a pipeline (does not delete member apps, but breaks promotion).
- `heroku domains:remove <domain> -a <app>` and `heroku certs:remove <name> -a <app>` — can take a production domain offline.
- `heroku maintenance:on -a <app>` — takes the app out of service; only do this when the user asked.
- `heroku reviewapps:disable -p <pipeline>` — turns off review apps for a pipeline.
- `heroku members:remove <user> -t <team>` and `heroku access:remove <user> -a <app>` — revokes access.
- `heroku authorizations:revoke <id>` and `heroku sessions:destroy <id>` — invalidates credentials.

For anything not in this list but still mutating (e.g. `config:set`, `ps:scale` to a non-zero value, `pipelines:promote`, `addons:upgrade`), default to **showing the command first** when the impact is production-facing, and running it directly for dev/staging targets. When in doubt, ask.

## Always pass `--app` (or `--team` / `--space` / `--pipeline`)

Auto-discovery from the local Git remote is convenient for humans but dangerous for an agent:

- The agent may have `cd`'d into a different repo than the user thinks.
- A repo can have multiple `heroku-*` remotes (`heroku-staging`, `heroku-prod`).
- `HEROKU_APP` env var may be set to something unexpected.

Rules:

- For any mutating command, pass `--app <name>` (or the appropriate `--team` / `--space` / `--pipeline`) explicitly. If the user didn't name the target, ask.
- If you must rely on auto-discovery, first run `heroku apps:info` (read-only) and **state the discovered app name to the user** before any mutation.
- Never run a mutating command against the first app in a `heroku apps` listing.

## Cost awareness

- Provisioning add-ons, scaling up, and enabling review apps all incur real charges. There is no free tier (as of 2026).
- Before `addons:create`, `ps:scale <type>=<n>>current`, `ps:type <size>`, or `ps:autoscale:enable`, mention that it's billable and name the plan/size if known.
- For review apps, remind the user that review-app dynos and add-ons are billed like normal apps.

## Secrets hygiene

- Never echo `HEROKU_API_KEY`, `heroku auth:token` output, database URLs from `heroku config`, or `pg:credentials` / `redis:credentials` payloads back in full. Mask everything after the scheme/host.
- Prefer attaching add-ons (which expose `*_URL` config vars) over copy-pasting connection strings into app code.
- When dumping `heroku config -s` (shell format) into a file, redact or skip secret values; don't commit `.env` files containing real Heroku URLs.

## Failure modes to watch for

- A `200` from `POST /dynos/.../actions/stop` does **not** stop a scaled process — it restarts. Scale to 0 instead. (See the `dynos` skill.)
- `pg:backups:capture` against a >20 GB database is slow and can fail; for large DBs, fork → pg_restore. (See the `postgres` skill.)
- Promoting a stateful build via `pipelines:promote` can break the downstream app — use Git deploys for stateful builds. (See the `pipelines` skill.)
- Mixing Cedar and Fir apps in one pipeline is unsupported. (See the `pipelines` skill.)

---

## agents

### `agents/heroku-ops.md`

```yaml
---
name: heroku-ops
description: Multi-step Heroku operations agent — deploy + verify, scale + watch, attach Postgres + migrate, promote through a pipeline, open a tunnel to a Private Space dyno. Plans first, runs read-only inspection, asks for confirmation on destructive steps, then verifies.
---
```

# Heroku ops agent

You are a Heroku operations specialist embedded in the user's coding agent. Your job is to safely execute **multi-step Heroku workflows** by orchestrating the `heroku` CLI and, where appropriate, the Platform API.

## Operating principles

1. **Plan first.** Before any mutation, state the plan in 3–7 numbered steps. Cite the specific commands you'll run. Wait for the user to approve (or for the prompt to make clear they've already approved).
2. **Read before write.** Always run the read-only inspection step first (`apps:info`, `ps`, `pg:info`, `addons`, `pipelines:info`, etc.) and **state the discovered app/target names out loud** before mutating. Never mutate an auto-discovered app without confirming its name.
3. **Explicit `--app` always.** Every mutating command passes `--app <name>` (or `--team` / `--space` / `--pipeline`). Never rely on remote auto-discovery for a mutation.
4. **Destructive = explicit confirmation.** Anything in the safety rule's destructive list (destroy, pg:reset, releases:rollback, config:unset, ps:scale …=0, container:rm, spaces:destroy, pipelines:destroy, addons:destroy, certs:remove, domains:remove, maintenance:on, members:remove, access:remove, authorizations:revoke, sessions:destroy) requires showing the exact command and getting a clear "yes" from the user.
5. **Prefer `--json` for parsing.** When you'll act on the output programmatically, request JSON.
6. **Verify after.** After every mutation, run a verification step (`ps`, `releases`, `pg:info`, `logs --tail -n 50`, `apps:info`) and report the resulting state to the user. Include any error line verbatim.
7. **Don't log in or rotate credentials for the user.** If a session is invalid, tell them to run `heroku login` and re-invoke you.
8. **Redact secrets.** Never echo `*_URL`, `*_KEY`, `*_TOKEN`, `*_SECRET`, `pg:credentials`, or `redis:credentials` payloads. Mask after the scheme/host.

## Standard workflows

### Deploy + verify (git push)

1. `heroku apps:info -a <app>` — confirm app exists, note stack + region.
2. `heroku ps -a <app>` — note current formation.
3. `git push heroku <branch>:main` (or `heroku container:push && heroku container:release` for Docker).
4. `heroku releases -a <app> -n 1` — confirm new release v(N).
5. `heroku ps:wait -a <app>` — wait for dynos to pick up the new release.
6. `heroku logs -a <app> --tail -n 50` — scan for errors.
7. Report: release number, dyno state, any error lines.

### Deploy + verify (container)

1. `heroku apps:info -a <app>` + `heroku ps -a <app>`.
2. `heroku container:login` (if not already).
3. `heroku container:push web -a <app>` (and other process types).
4. `heroku container:release web -a <app>`.
5. `heroku releases -a <app> -n 1` + `heroku ps:wait -a <app>`.
6. `heroku logs -a <app> --tail -n 50`.
7. Report.

### Scale + watch

1. `heroku ps -a <app> --json` — current formation.
2. State the planned `ps:scale` / `ps:type` command and the new quantity/size. **Mention billable impact.**
3. Get confirmation.
4. `heroku ps:scale web=N -a <app>` (and/or `ps:type`).
5. `heroku ps:wait -a <app>`.
6. `heroku ps -a <app>` + `heroku logs -a <app> --tail -n 30 --source app`.
7. Report new formation + any error lines.

### Attach Postgres + run migrations

1. `heroku addons -a <app>` — confirm no existing DB (or note existing).
2. `heroku addons:plans heroku-postgresql --json` — confirm plan slug.
3. State the `addons:create` command + plan. **Mention billable impact.**
4. Get confirmation.
5. `heroku addons:create heroku-postgresql:<plan> -a <app> --as DATABASE`.
6. `heroku addons:wait -a <app>` (or `heroku pg:wait -a <app>`).
7. `heroku pg:info -a <app>` — confirm DB ready.
8. `heroku run <migrate-cmd> -a <app> --exit-code --no-tty` — run migrations.
9. If exit non-zero: surface the migration error, do **not** proceed. Suggest rollback.
10. `heroku ps:restart -a <app>` (so dynos pick up any new schema).
11. `heroku logs -a <app> --tail -n 30 --source app`.
12. Report: add-on attachment, `DATABASE_URL` is set (don't print it), migration exit code, dyno state.

### Promote staging → production in a pipeline

1. `heroku pipelines:info <pipeline>` — confirm stages and which app is staging vs prod.
2. `heroku pipelines:diff -a <staging-app>` — show what would change.
3. State the `pipelines:promote` command. **Confirm the downstream app name.**
4. Get confirmation.
5. `heroku pipelines:promote -a <staging-app>`.
6. `heroku releases -a <prod-app> -n 1` — confirm new release.
7. `heroku ps:wait -a <prod-app>`.
8. `heroku logs -a <prod-app> --tail -n 50`.
9. Report: release number on prod, dyno state, error lines.

### Rollback

1. `heroku releases -a <app> -n 20` — show recent releases.
2. `heroku pg:info -a <app>` — check DB state (rollback can mismatch a migrated schema).
3. State the `releases:rollback v<N>` command and the version being rolled back to. **Warn about stateful-migration risk.**
4. Get explicit confirmation.
5. (Optional, for risky rollbacks) `heroku ps:scale web=0 -a <app>` first.
6. `heroku releases:rollback v<N> -a <app>`.
7. `heroku ps:wait -a <app>`.
8. `heroku logs -a <app> --tail -n 50`.
9. (If scaled to 0) `heroku ps:scale web=<original> -a <app>`.
10. Report: new release (the rollback creates v(N+1) matching v<N>), dyno state, error lines.

### Postgres backup + restore (fork for large DB)

For DBs ≤ 20 GB:

1. `heroku pg:info -a <app>` — confirm DB size ≤ 20 GB.
2. `heroku pg:backups:capture -a <app> --verify`.
3. `heroku pg:backups:info <backup-id> -a <app>` — confirm `Succeeded` and size.
4. Report.

For DBs > 20 GB, follow the fork → pg_dump flow in the `postgres` skill. Get confirmation before `pg:copy` or `pg:backups:restore` — both are destructive on the target.

### Open a tunnel to a Private Space dyno

1. `heroku spaces:info <space>` + `heroku apps -s <space>` — confirm the space and target app.
2. `heroku ps -a <app>` — pick a dyno.
3. `heroku ps:forward <local-port> -a <app>` (or `heroku ps:socks -a <app>` for a SOCKS proxy).
4. Tell the user the local port and how to connect.
5. Stay attached until the user signals done; then close the tunnel.

## Failure handling

- If a CLI command returns non-zero: surface the exact stderr, stop the workflow, and propose a fix. Do not blindly continue.
- If the Platform API returns 429: back off using `RateLimit-Reset` and retry. Tell the user you're waiting.
- If a mutation unexpectedly affects a different app than intended (e.g. wrong `--app`): stop, report immediately, and ask whether to roll back.

## What you don't do

- Don't run `heroku login` or `heroku auth:login` for the user.
- Don't create or revoke long-lived OAuth authorizations (`authorizations:create`/`revoke`) without explicit confirmation.
- Don't destroy apps, spaces, pipelines, or DB add-ons without explicit per-action confirmation, even if the user said "clean up everything".
- Don't echo secrets (URLs, tokens, credentials).
- Don't quote plan prices as authoritative — they drift. Say "billable" and suggest verifying on the Dev Center.

---

## commands

### `commands/heroku-addons-list.md`

```yaml
---
name: heroku-addons-list
description: List Heroku add-ons across all apps (or one app) in a compact table. Read-only.
---
```

# /heroku-addons-list

Inventory add-ons. Read-only.

## Inputs

- `--app <name>` (optional; if omitted, lists across all accessible apps).
- `--service <slug>` (optional; filter by service, e.g. `heroku-postgresql`).

## Steps

1. Run `heroku addons -A --json` (or `heroku addons -a <app> --json` if `--app` given).
2. Parse JSON. Each row has: app name (or `app:name`), add-on name/id, plan (`service:plan`), state, attachment alias.
3. If `--service`, filter rows where `service.name == <slug>` or `plan.name` starts with `<slug>:`.
4. Render as a compact table:

   ```
   App                  Add-on                          Plan                                   State
   -------------------  ------------------------------  -------------------------------------  ---------
   my-app               postgresql-asymmetrical-12345   heroku-postgresql:essential-0          provisioned
   my-app               redis-animated-67890           heroku-redis:mini                      provisioned
   my-app               papertrail-abc                  papertrail:choklad                     provisioned
   ```

5. If any add-on is in a non-`provisioned` state (`provisioning`, `deprovisioned`, `error`), flag it at the bottom.
6. Print totals: N add-ons across M apps; sum by service.

## Safety

Read-only. The `addons --json` output may include `config_vars` references (e.g. `DATABASE_URL`) — don't print the values, only the var names.

---

### `commands/heroku-db-backup.md`

```yaml
---
name: heroku-db-backup
description: Capture a Heroku Postgres backup (`heroku pg:backups:capture`) and report status. For DBs >20GB, suggests the fork→pg_dump flow instead.
---
```

# /heroku-db-backup

Capture a Postgres backup for an app's primary DB. Read-only on the database (capture doesn't mutate data).

## Inputs

- `--app <name>` (required; ask if missing).
- `--database <attachment>` (default: `DATABASE`).
- `--verify` — run `pg:backups:capture --verify` (slower; confirms integrity).
- `--download` — after a successful capture, also `pg:backups:download <id>` to `./latest.dump`.

## Steps

1. `heroku pg:info -a <app> --json` — confirm DB exists, note `size_in_bytes` and `state`.
2. If size > 20 GB:
   - Do **not** run `pg:backups:capture` automatically.
   - Explain the >20 GB rule and propose the fork → `pg_dump` flow from the `postgres` skill.
   - Stop and ask the user how to proceed.
3. State the `pg:backups:capture` command and get confirmation (capture is read-only but creates a billable backup row on some plans).
4. `heroku pg:backups:capture <database> -a <app> [--verify]`.
5. From the output, capture the backup ID (`bNNN`).
6. `heroku pg:backups:info <id> -a <app>` — confirm `Succeeded`, report size and elapsed.
7. If `--download`: `heroku pg:backups:download <id> -a <app>` — note the local file path (`latest.dump` by default). Warn that it contains DB data — don't commit it.
8. Report: backup ID, status, size, downloadable URL (don't print the URL's embedded credentials if any).

## Safety

- Capture doesn't modify the DB. Safe to run on production.
- Downloading writes a file containing real data. Don't commit it; don't paste contents into chat.

---

### `commands/heroku-deploy.md`

```yaml
---
name: heroku-deploy
description: Deploy the current branch to a Heroku app via git push (or container push+release) and verify. Requires explicit `--app`. Destructive-adjacent: shows the push command first.
---
```

# /heroku-deploy

Deploy the current Git branch to a Heroku app and verify the release. Requires the user to name the target app (`--app <name>` or "deploy to <name>").

## Inputs

- `--app <name>` (required) — target Heroku app.
- `--container` — use `heroku container:push && container:release` instead of `git push`.
- `--branch <name>` (default: current branch) — local branch to push.
- `--type <process-type>` (container only) — which process type to push/release (default: `web`).

## Steps

1. If `--app` not provided, ask. **Never auto-discover.**
2. `heroku apps:info -a <app> --json` — confirm app exists. Note its stack and generation.
3. `heroku ps -a <app> --json` — note current formation (for rollback reference).
4. If `--container`:
   - `heroku container:login` (idempotent; safe).
   - `heroku container:push <type> -a <app>`.
   - Show the user the next command (`heroku container:release <type> -a <app>`) and get confirmation — release is the point of no return.
   - `heroku container:release <type> -a <app>`.
   - Else:
   - Detect current branch: `git rev-parse --abbrev-ref HEAD`.
   - Show the user the exact `git push heroku <branch>:main` command. Get confirmation if pushing to a production app.
   - Run the push.
5. `heroku releases -a <app> -n 1` — confirm new release v(N).
6. `heroku ps:wait -a <app>` — wait for the new formation to come up.
7. `heroku logs -a <app> --tail -n 80 --source app` — scan for errors.
8. Report: release number, dyno state (count up/crashed), any error lines verbatim. If `H10`/`H14`/`R14` appears, explain and suggest a fix (see the `logs` skill).

## Rollback hint

If the deploy broke the app, suggest `heroku releases:rollback v<N-1> -a <app>` (see the `releases` skill) and remind the user of the stateful-migration risk.

## Safety

- Never deploy without an explicit `--app`. Auto-discovery is forbidden for mutations.
- The push itself is reversible (rollback), but a bad deploy to production takes the app down. Confirm the app name before pushing to anything the user called "prod" or "production".

---

### `commands/heroku-logs.md`

```yaml
---
name: heroku-logs
description: Tail or dump Heroku app logs with source/process filters, plus a drain listing. Optional `--app`; if omitted, asks.
---
```

# /heroku-logs

Read logs. No mutations.

## Inputs

- `--app <name>` (required; ask if missing).
- `--tail` (default: dump last 100 lines). Live tail.
- `-n <count>` (default: 100). Number of lines.
- `--source <app|router|dyno|run|api>` (default: all).
- `--ps <type-or-dyno>` (e.g. `web`, `web.1`, `worker`).
- `--drains` — also list configured log drains (`heroku drains -a <app>`).

## Steps

1. `heroku apps:info -a <app>` — confirm app exists.
2. Build the log command:
   ```
   heroku logs -a <app> [--tail] [-n <count>] [--source <s>] [--ps <p>]
   ```
3. Run it. If `--tail`, run with a 60s timeout (or stream and stop on user signal).
4. If `--drains`, also run `heroku drains -a <app> --json` and summarize.
5. Surface log lines as-is (the user is the audience). If a recognizable error code appears (`H10`, `H12`, `H14`, `R14`, `R15`), append a one-line explanation and a suggested fix (see the `logs` skill table).

## Safety

Read-only. No secrets expected in Heroku-emitted log lines, but if the user's app logs `*_URL` or tokens, redact those before echoing back.

---

### `commands/heroku-pipeline-promote.md`

```yaml
---
name: heroku-pipeline-promote
description: Promote the latest release of a Heroku pipeline app to its downstream stage(s) (`heroku pipelines:promote`). Pre-flight `pipelines:diff`; requires confirmation.
---
```

# /heroku-pipeline-promote

Promote a staging app's latest slug to its downstream (production) app(s) in a pipeline.

## Inputs

- `--app <name>` (required) — the upstream (e.g. staging) app whose latest release to promote.
- `--to <name>` (optional) — specific downstream app. If omitted, promotes to all downstreams of `<app>` in the pipeline.

## Steps

1. `heroku pipelines:info <pipeline-containing-app>` — find the pipeline and confirm `<app>` is the upstream for `<to>` (or for some downstream). If `<app>` is not in a pipeline, stop.
2. `heroku pipelines:diff -a <app>` — show what would change (commits + config differences).
3. If stateful build detected (e.g. config differences that the build would have baked in), warn the user: promotion of stateful builds can break the downstream. Suggest Git deploy instead.
4. State out loud:
   - Source app + its latest release (`v<N>`).
   - Downstream app(s) being promoted to.
   - The diff summary.
5. Get **explicit** confirmation.
6. `heroku pipelines:promote -a <app> [--to <to>]`.
7. For each downstream:
   - `heroku releases -a <downstream> -n 1` — confirm new release.
   - `heroku ps:wait -a <downstream>`.
   - `heroku logs -a <downstream> --tail -n 50`.
8. Report: per-downstream release number, dyno state, error lines.

## Safety

- Promotion does not copy config vars or add-ons — only the slug. If the downstream is missing a required config var, the new release may crash. Mention this if the diff shows config differences.
- Confirm the downstream app name(s). Promoting to the wrong app is a real-world incident.
- For stateful builds, do not promote — recommend Git deploy. See the `pipelines` skill.

---

### `commands/heroku-rollback.md`

```yaml
---
name: heroku-rollback
description: Roll back a Heroku app to a previous release (`heroku releases:rollback`). Destructive — requires explicit confirmation and warns about stateful-migration risk.
---
```

# /heroku-rollback

Roll back to an earlier release. **Destructive** — see the safety rule and the `releases` skill.

## Inputs

- `--app <name>` (required; ask if missing).
- `--to v<N>` (optional; defaults to the previous release).

## Steps

1. `heroku releases -a <app> -n 20` — show recent releases.
2. `heroku pg:info -a <app>` — check DB state (rollback can mismatch a migrated schema).
3. Determine target: `--to v<N>` if given, else the release before the current one.
4. State out loud:
   - Current release.
   - Target release (`v<N>`).
   - **Warning:** if any release between target and current ran a DB migration, the older code may not match the current schema. Additive migrations are usually fine; destructive migrations (`DROP COLUMN`, type changes) are not.
5. Get **explicit** confirmation (a clear "yes" / "go ahead").
6. (Optional, for risky rollbacks) Suggest scaling web to 0 first:
   `heroku ps:scale web=0 -a <app>` — only with user consent.
7. `heroku releases:rollback v<N> -a <app>` — creates a new release v(M+1) matching v<N>.
8. `heroku ps:wait -a <app>`.
9. (If scaled to 0) `heroku ps:scale web=<original> -a <app>`.
10. `heroku logs -a <app> --tail -n 50 --source app`.
11. Report: new release number, dyno state, error lines. If `H10`/`H14` appears, the rollback didn't fix the issue — propose next steps.

## Safety

- Always `--app <name>`. Never auto-discover.
- Always confirm. Rollback is reversible (re-deploy) but takes the app through a state transition.
- If the user is unsure whether a migration ran between target and current, **stop** and suggest inspecting `releases:output` for each intermediate release before proceeding.

---

### `commands/heroku-scale.md`

```yaml
---
name: heroku-scale
description: Scale Heroku dynos (`heroku ps:scale` and `ps:type`) and wait for the new formation. Requires explicit `--app`. Mentions billable impact before applying.
---
```

# /heroku-scale

Change the dyno formation for an app. Requires explicit `--app` and explicit scale arguments.

## Inputs

- `--app <name>` (required).
- Scale spec, e.g. `web=3`, `web+1`, `worker=2`, `web=3:performance-l` (combined qty+size), or `web=standard-2x` (vertical via `ps:type`).
- Multiple at once: `web=2 worker=3`.

## Steps

1. If `--app` or scale spec missing, ask. Never auto-discover.
2. `heroku ps -a <app> --json` — current formation.
3. Compute the delta (current → desired) and **state it out loud**:
   ```
   web: 1 → 3 (standard-1x)
   worker: 1 → 2 (standard-1x)
   Estimated new monthly cost delta: +$100/mo (verify on Dev Center)
   ```
   Mention billable impact and that the user should confirm plan/price on the Dev Center (numbers drift).
4. Get confirmation.
5. For pure horizontal (`web=N`): `heroku ps:scale web=N worker=M -a <app>`.
   For vertical (`web=<size>`): `heroku ps:type web=<size> -a <app>`.
   For combined (`web=N:<size>`): `heroku ps:scale web=N:<size> -a <app>`.
6. `heroku ps:wait -a <app>`.
7. `heroku ps -a <app>` — confirm new formation.
8. `heroku logs -a <app> --tail -n 30 --source app` — scan for errors.
9. Report new formation + any error lines.

## Safety

- Scaling `web=0` takes the app offline. Treat as destructive and require explicit confirmation (safety rule).
- Scaling up costs money. Always mention billable impact before applying.
- Vertical resize (`ps:type`) restarts all dynos of that type. Brief downtime on Basic/Eco; rolling on Private spaces.

---

### `commands/heroku-status.md`

```yaml
---
name: heroku-status
description: Show Heroku auth status and a summary of apps and dynos. Optional `--app` to include dyno status for one app.
---
```

# /heroku-status

Run a quick Heroku health check. No mutations.

## Steps

1. Run `heroku auth:whoami` to confirm the session. If it fails, stop and tell the user to run `heroku login`.
2. Run `heroku auth:2fa` and report 2FA status.
3. Run `heroku apps --json` and summarize: total count, grouped by team (if visible), and any flagged states.
4. If the user supplied `--app <name>` (or mentioned an app name in their message), also run:
   - `heroku apps:info -a <app> --json` — region, stack, generation, owner, web URL.
   - `heroku ps -a <app> --json` — dyno state summary (count by `up`/`starting`/`crashed`/`idle`).
   - `heroku releases -a <app> -n 5` — last 5 releases.
   - `heroku addons -a <app> --json` — add-on count by service.
5. Report a compact summary in the chat. Redact any `*_URL` values that appear in `addons` JSON.

## Output format

```
Heroku status:
  User: <email>   2FA: enabled
  Apps: <N> (across <M> teams)

App: <name>
  Region: us   Stack: heroku-24   Generation: cedar
  Web URL: https://<name>.herokuapp.com/
  Dynos: 3 up, 0 crashed
  Add-ons: heroku-postgresql:essential-0, heroku-redis:mini, papertrail:choklad
  Last release: v42 (Config add FOO_BAR) ~1h ago
```

## Safety

This command is read-only. No `--app` mutation, no confirmation needed.

---

## README.md

### `README.md`

# heroku — Cursor plugin

A Cursor plugin that brings the [Heroku](https://www.heroku.com/) platform into your coding agent. It teaches the agent how to use the locally-installed `heroku` CLI, the Heroku Platform API, and managed services (Postgres, Redis, add-ons, pipelines, spaces, etc.) so you can deploy, scale, inspect, and operate Heroku apps from inside Cursor.

The plugin is **CLI-first**: it assumes the `heroku` binary is already installed and authenticated on your machine. It does not ship the CLI, log in for you, or store credentials.

## Prerequisites

- `heroku` CLI installed and on `$PATH`. Verify with `heroku --version`.
- Authenticated session: `heroku login` (browser) or `heroku auth:login -i` (interactive). Verify with `heroku auth:whoami`.
- For Platform API calls from scripts: a token from `heroku authorizations:create -e 2592000` (30 days) exported as `HEROKU_API_KEY`, or the netrc entry that `heroku login` writes.
- For app commands that auto-discover the target: run from inside a Git clone whose `heroku` remote is set (`heroku git:remote -a <app>`). Otherwise pass `--app <name>` explicitly.

## Installation

This plugin lives at `~/.cursor/plugins/local/heroku/`, which Cursor loads automatically — no install step required. If Cursor is already running, reload the window once so the new plugin is discovered.

To move it elsewhere (e.g. into a repo for marketplace submission), copy the whole `heroku/` directory and add a `.cursor-plugin/marketplace.json` entry pointing at it.

## What's included

### Rules (`rules/`)
- **`heroku-cli.mdc`** — proactively use the `heroku` binary for state; prefer `--json` output when the agent needs to parse; never scrape the dashboard.
- **`heroku-safety.mdc`** — destructive commands (`apps:destroy`, `addons:destroy`, `pg:reset`, `releases:rollback`, `config:unset`, `ps:scale …=0`, `container:rm`, `spaces:destroy`) require explicit user confirmation and an explicit `--app`. Never run them against an auto-discovered app without confirming the name first.

### Skills (`skills/`)
Each skill is a focused, copy-pastable reference the agent loads on demand. They cover every Heroku CLI topic plus the Platform API:

| Skill | Covers |
| --- | --- |
| `apps` | `heroku apps`, `apps:create`, `apps:destroy`, `apps:info`, `apps:errors`, `apps:stacks`, `apps:open`, `apps:lock/join/leave`, favorites, diffs |
| `dynos` | `heroku ps`, `ps:scale`, `ps:type`, `ps:restart`, `ps:stop`, `ps:kill`, `ps:resize`, `ps:exec`, `ps:copy`, `ps:forward`, `ps:socks`, `ps:wait`, `ps:autoscale` |
| `addons` | `heroku addons`, `addons:create`, `addons:attach/detach`, `addons:destroy`, `addons:upgrade`, `addons:plans`, `addons:services`, `addons:info`, `addons:wait` |
| `postgres` | `heroku pg`, `pg:info`, `pg:backups` (capture/restore/schedule), `pg:credentials`, `pg:settings`, `pg:diagnose`, `pg:outliers`, `pg:copy`, `pg:links`, `pg:upgrade`, connection pooling, follower databases |
| `redis` | `heroku redis`, `redis:info`, `redis:cli`, `redis:credentials`, `redis:promote`, `redis:maxmemory`, `redis:timeout`, `redis:keyspace-notifications`, `redis:upgrade`, `redis:wait` |
| `config` | `heroku config`, `config:set/get/unset`, `config:edit`, secret hygiene, `--shell` / `--json` output |
| `pipelines` | `heroku pipelines`, `pipelines:create/add/remove`, `pipelines:promote`, `pipelines:diff`, `pipelines:connect`, `pipelines:info/open/destroy/rename` |
| `ci` | `heroku ci`, `ci:config`, `ci:debug`, test runs, `app.json` test setup |
| `reviewapps` | `reviewapps:enable/disable`, PR-driven ephemeral apps, cost considerations |
| `domains` | `heroku domains`, custom domains, DNS targets, wildcard, SNI/ACM |
| `certs` | `heroku certs`, `certs:add/update/remove`, `certs:auto` (ACM), `certs:generate` |
| `buildpacks` | `heroku buildpacks`, `buildpacks:add/remove/set/clear`, search, versions, multi-buildpack ordering |
| `container` | `heroku container:login/logout/push/release/pull/rm/run`, Docker-based deploys, `procfile`/`Dockerfile` |
| `logs` | `heroku logs --tail`, `drains:add/remove`, syslog/HTTPS drains, `ps:exec` log streams |
| `releases` | `heroku releases`, `releases:info`, `releases:output`, `releases:retry`, `releases:rollback` |
| `run` | `heroku run`, one-off dynos, `--exit-code`, `--type`, env passing, no-tty for piping |
| `access` | `heroku access`, collaborators, `access:add/remove/update`, team membership |
| `orgs` | `heroku orgs`, `members:add/remove/set`, roles, invitations, enterprise teams |
| `spaces` | `heroku spaces`, `spaces:create/destroy/info/rename/transfer/topology/ps`, `spaces:peerings`, `spaces:trusted-ips`, `spaces:vpn`, `spaces:drains`, Private/Shield spaces |
| `maintenance` | `heroku maintenance:on/off` |
| `webhooks` | `heroku webhooks`, `webhooks:add/remove/update/info`, deliveries, events |
| `telemetry` | `heroku telemetry`, `telemetry:add/info/remove/update` (OTLP drains) |
| `usage` | `heroku usage:addons`, team metering, cost investigation |
| `data` | `heroku data:maintenances`, `data:pg` (Postgres Advanced), maintenance windows |
| `auth` | `heroku auth:login/logout/token/whoami`, `authorizations:create/info/revoke/rotate/update`, `sessions`, 2FA |
| `git` | `heroku git:clone`, `git:remote`, deploy-via-git flow |
| `local` | `heroku local`, Procfile, env files, port overrides |
| `platform-api` | Base URL `https://api.heroku.com`, `Accept: application/vnd.heroku+json; version=3`, auth, key endpoints (apps, formations, dynos, config-vars, releases, builds, addons, domains, pipelines, spaces), rate limits, schema at `/schema` |

### Agent (`agents/`)
- **`heroku-ops`** — for multi-step operations: "deploy and verify", "promote staging → prod and watch logs", "attach Postgres, run migrations, set `DATABASE_URL`", "scale web dynos and enable autoscale", "open a tunnel to a Private Space dyno". The agent plans, runs read-only inspection first, asks for confirmation on destructive steps, then verifies.

### Commands (`commands/`)
- `/heroku-status` — whoami, list apps, dyno status for `--app`.
- `/heroku-deploy` — git push or `container:push && container:release`, then watch `releases:output`.
- `/heroku-scale` — `ps:scale` with autodetected formation, plus `ps:wait`.
- `/heroku-logs` — `logs --tail` with optional filter and drain listing.
- `/heroku-db-backup` — `pg:backups:capture`, then `pg:backups:info`.
- `/heroku-rollback` — `releases:rollback` with explicit confirmation.
- `/heroku-addons-list` — `addons --all --json` formatted as a table.
- `/heroku-pipeline-promote` — `pipelines:promote` with a pre-flight `pipelines:diff`.

## Best-practice quick reference (2026)

These reflect current Heroku behaviour and are encoded into the skills:

- **Two runtime generations.** Cedar (long-standing, Common Runtime + Private/Shield Spaces) and Fir (Kubernetes + Cloud Native Buildpacks). A pipeline can only contain apps from one generation — don't mix.
- **No free tier.** Eco ($5/mo shared pool, sleeps after 30 min) is the cheapest. Basic/Standard/Performance tiers are always-on. See Dyno Tiers in Dev Center.
- **Always pass `--app` for scripted/agent operations.** Auto-discovery from the Git remote is convenient for humans but dangerous for automation — an `cd` into the wrong repo silently targets the wrong app.
- **Use `--json` for parsing.** Every list/info command supports it; it's stable across terminal styling changes.
- **Scale via formation, not `ps:stop`.** `ps:stop` on a scaled process restarts it. To actually scale down, use `ps:scale <type>=0` (CLI) or `PATCH /apps/{name}/formation/{type}` with `quantity: 0` (API).
- **Prefer `pipelines:promote` over re-push for stateless builds.** For stateful builds (config baked into the slug), use Git/GitHub deploys instead.
- **Postgres backups.** Use `pg:backups:capture` for DBs ≤ 20 GB. For larger DBs, fork → pg_restore from the fork with `--no-acl --no-owner`. Always `pg:backups:schedule` for production.
- **Add-on attachments expose `*_URL` config vars.** Don't hardcode connection strings — read them from `heroku config`.
- **Review Apps cost money.** Dynos and add-ons in review apps are billed like normal apps. Disable review apps on idle pipelines.
- **Private/Shield spaces.** Private dynos get network isolation + rolling deploys; Shield dynos add HIPAA compliance. Both require a Private/Shield Space.

## Limitations

- The plugin does not install the `heroku` CLI, authenticate you, or manage API tokens. It assumes a working local setup.
- Live data access requires your CLI session or `HEROKU_API_KEY` to be valid.
- Costs and plan names drift — always confirm current pricing on the Heroku Dev Center before quoting numbers in user-facing output.

## Contributing

The plugin is intentionally plain Markdown + JSON. To extend:

1. Add a new `skills/<name>/SKILL.md` with `name` and `description` frontmatter.
2. Reference new rules in `rules/` and slash commands in `commands/`.
3. Re-run the review checklist in `skills/review-plugin-submission` (from the `create-plugin` plugin) before committing.
4. Bump `version` in `.cursor-plugin/plugin.json` and add a `CHANGELOG.md` entry.

## License

MIT — see [LICENSE](./LICENSE).

---

## CHANGELOG.md

### `CHANGELOG.md`

# Changelog

All notable changes to the `heroku` Cursor plugin are documented here.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-18

### Added
- Initial release of the `heroku` Cursor plugin.
- CLI awareness rule — proactively invoke the `heroku` binary for state inspection, prefer it over scraping the dashboard.
- Safety rule — destructive Heroku operations require explicit confirmation and use `--app` to avoid acting on the wrong app.
- Skills for every major Heroku service area: apps, dynos, addons, pg, redis, config, pipelines, ci, reviewapps, domains, certs, buildpacks, container, logs/drains, releases, run, access/members/orgs, spaces, maintenance, webhooks, telemetry, usage, data, auth, git, local, and the Platform API.
- Ops agent `heroku-ops` for multi-step workflows (deploy + scale + verify, attach Postgres + run migrations, promote through a pipeline, etc.).
- Slash commands: `/heroku-status`, `/heroku-deploy`, `/heroku-scale`, `/heroku-logs`, `/heroku-db-backup`, `/heroku-rollback`, `/heroku-addons-list`, `/heroku-pipeline-promote`.
- README with installation, prerequisites, component map, and best-practice quick reference.

---
