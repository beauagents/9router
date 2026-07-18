# agent-kit plugin — consolidated skills reference

> Auto-consolidated from `/Users/beau/.cursor/plugins/local/agent-kit` on 2026-07-18T22:56:40.022Z
> Every `.md`/`.mdc` file under the plugin directory is included below, grouped by category. Frontmatter is rendered as yaml; the body is preserved as markdown.
> The canonical machine-readable plugin still lives at the source path above — this file is a portable reference bundle.

## Table of contents
1. [skills](#skills) — 7 file(s)

## skills

### `skills/audit/SKILL.md`

```yaml
---
name: audit
description: "Audit a shipped repo for production-readiness gaps across RLS, webhooks, secrets, grants, Stripe idempotency, mobile UX, and deployment health."
category: security
risk: critical
source: community
source_repo: commitshow/production-audit
source_type: community
date_added: "2026-05-04"
author: commitshow
tags: [security, audit, production, vibe-coding, rls, webhook, stripe, supabase, mobile]
tools: [claude, cursor, gemini, codex, antigravity]
license: "MIT"
license_source: "https://github.com/commitshow/production-audit/blob/main/LICENSE"
---
```

# Production Audit

## Overview

A skill that runs an external audit on a shipped repo's deployed state — live URL, GitHub signals, secrets exposure, RLS gaps, webhook idempotency, indexes, observability, prompt injection, and ten other failure modes that AI-assisted projects routinely miss.

This is **complementary** to in-session security skills (`security-review`, OWASP-style, VibeSec, Trail of Bits). Those scan the editor buffer at write-time. This scans the deployed product after you commit. Different timing, different inputs, different findings. Run both for serious launches.

The skill wraps the [commit.show](https://commit.show) audit engine via the public CLI (`npx commitshow@0.3.23 audit . --json`). Stable JSON envelope (`schema_version: "1"`, additive-only). Writes a `.commitshow/audit.{md,json}` sidecar so future agent sessions can read prior state without re-running the engine.

## When to Use This Skill

- Use when the user asks "is this production-ready", "what would break in prod", "score my project", "what did I miss", "audit my repo", "ready to ship".
- Use right after merging a feature branch to `main` (helpful as a pre-deploy gate).
- Use before a public launch / Show HN post / investor demo.
- Use when `git log` shows >20 commits since the last `.commitshow/audit.md` was written.

### Skip when

- During active in-session coding — use `security-review` / OWASP-style for line-level patterns. This skill is for post-merge / pre-ship review.
- For library / scaffold-form repos — the engine handles **app form** best; libraries get a partial-substitute score.
- If `.commitshow/audit.json` already exists and is < 1 hour old, read that instead of re-running. Audit is rate-limited (anonymous: 20/IP/day · 5/repo/day · 2000/day global).
- Inside a private / non-GitHub repo — the audit pulls public GitHub signals, so private repos return a `not_found` error.

## How It Works

### Step 1: Run the audit

From the repo root. The CLI is pinned to an exact reviewed version so future npm releases are not selected silently. Because `npx` downloads and runs npm package code locally with the current user's permissions, run it only after the user explicitly approves this external execution and only in a repository where local files and environment variables are safe for that process to access. The sidecar directory is created up-front, and stderr is split off so install/deprecation warnings can't corrupt the JSON envelope:

```bash
mkdir -p .commitshow
npx commitshow@0.3.23 audit . --json \
  > .commitshow/audit.json \
  2> .commitshow/audit.stderr.log
```

This also writes a human-readable `.commitshow/audit.md` next to it. Subsequent invocations should diff against the prior `audit.json` if it exists, so you can lead with "+5 since yesterday's audit" instead of just an absolute number.

If the user pointed at a remote URL instead of `.`, swap `.` for the URL — keep the same `mkdir -p` + version pin + stderr split:

```bash
mkdir -p .commitshow
npx commitshow@0.3.23 audit github.com/owner/repo --json \
  > .commitshow/audit.json \
  2> .commitshow/audit.stderr.log
```

### Step 2: Parse the envelope

The JSON envelope is stable (`schema_version: "1"`, additive-only). Read these fields:

| Field | Meaning |
|---|---|
| `score.total` | 0-100 production-readiness score |
| `score.delta_since_last` | change vs. parent snapshot · positive = improving |
| `score.band` | `strong` (80+) · `mid` (60-79) · `early` (<60) |
| `concerns[]` | top issues, ordered by impact · each has `axis` + `bullet` |
| `strengths[]` | top 3 things that work · for context only |
| `standing` | optional · only when the project is auditioning on commit.show |
| `snapshot.created_at` / `trigger_type` | when the audit ran |

Concerns are sorted by decision-impact, not severity. Position 1 is the bullet to lead with.

### Step 3: Surface to the user

Lead with score + trajectory in **one sentence**, then the top concerns. Do not dump the full JSON. Format:

```
Score: 82/100 (+5 since yesterday) · band: strong

Top concerns:
  ↓ [Security] No API rate limiting on /auth — IP cap missing
  ↓ [Infrastructure] webhook handler at api/stripe.ts — signature verified, but no
    idempotency-key check (replay attack window open)

Want me to fix the webhook idempotency gap first?
```

Rules:
- Use the exact bullet from `concerns[].bullet` — the audit engine already wrote action-oriented copy.
- Don't list strengths unless the user explicitly asks. They're not actionable in this context.
- Always end with a follow-up question that names a specific concern. Don't ask "what do you want to do?" — ask "fix X first?".
- If `score.delta_since_last` is negative or null, lead with the absolute score only.

### Step 4: If the user picks a concern, scope a fix

For the chosen concern:
1. Read the file(s) cited in the bullet.
2. Confirm the gap matches the description (the engine occasionally over-flags when the issue is mitigated elsewhere).
3. Propose a minimal patch — single-file when possible.
4. **Don't apply without explicit approval.** Show the diff first. The user is deciding what to ship; you're a lens.

After applying a fix, suggest re-running with `--refresh` (same canonical form as Step 1, so `audit.json` stays the source of truth for delta calculations):

```bash
mkdir -p .commitshow
npx commitshow@0.3.23 audit . --json --refresh \
  > .commitshow/audit.json \
  2> .commitshow/audit.stderr.log
```

## Examples

### Example 1: User asks "is this production-ready?"

```bash
mkdir -p .commitshow
npx commitshow@0.3.23 audit . --json \
  > .commitshow/audit.json \
  2> .commitshow/audit.stderr.log
```

Then surface:

```
Score: 67/100 · band: mid

Top concerns:
  ↓ [Security] members table uses column-level GRANT but paid_audits_credit
    column lacks SELECT grant — silent 42501 on every read
  ↓ [Infrastructure] stripe.checkout.sessions.create called without
    idempotencyKey — duplicate-charge surface

Want me to fix the column GRANT first? Single SQL line.
```

### Example 2: Cross-check a specific concern

User: "show me where the webhook idempotency gap is"

```bash
cat .commitshow/audit.json | jq '.concerns[] | select(.axis=="Infrastructure")'
```

Find the file path in the bullet, read it, confirm the gap matches.

## Best Practices

- ✅ Always cite the exact bullet from `concerns[].bullet` — they're already action-oriented
- ✅ Lead with score + delta in a single sentence, then concerns
- ✅ End with a specific follow-up question naming a concern
- ✅ Read prior `.commitshow/audit.json` before re-running (within 1h)
- ✅ Use `--refresh` after the user merges a fix so the next audit reflects it
- ❌ Don't dump full JSON to the user
- ❌ Don't list strengths unless the user explicitly asks
- ❌ Don't apply fixes without approval — show diff first
- ❌ Don't fault private repos for not auditing — explain why and suggest making public

## Limitations

- This skill does not replace environment-specific validation, testing, or expert review.
- The audit engine is calibrated for **deployed apps** with a live URL. CLI / library / scaffold form gets a partial-substitute score (max ~45/50 on the audit pillar) — fair but not flattering.
- Behind a corporate firewall blocking `*.supabase.co`, the API call fails. There is no offline mode — the audit relies on the public engine.
- Cold audit takes 60-90s. Cached audits (within 7 days) return instantly. `--refresh` force-bypasses cache (counts against rate limits).

## Security & Safety Notes

- The skill executes `npx commitshow@0.3.23 audit ...`, which downloads and runs that exact npm package version locally, then calls the public API at `https://api.commit.show` (proxied to Supabase Edge Functions). Do not replace the exact version with `latest` or a semver range during normal use.
- Treat the CLI as external code with local process privileges. It must not be run in repositories containing secrets or sensitive uncommitted files unless the user has explicitly accepted that risk. No credentials are intentionally sent to the API, but the local process can access files and environment variables available to the current user.
- The CLI writes `.commitshow/audit.{md,json}` in the current working directory. These files are safe to commit (no secrets) but conventionally gitignored as transient artifacts.
- The audit engine **only reads** public GitHub signals. It does not modify the user's repo or push commits.
- All per-finding fix proposals must be shown as diffs and approved by the user before any edit. Never apply without explicit confirmation.

## Common Pitfalls

- **Problem:** Audit returns `not_found` for a private repo
  **Solution:** The engine pulls public GitHub signals only. Either make the repo public or use `--no-network` for local-only deterministic checks.

- **Problem:** Rate limit hit (`429`)
  **Solution:** Wait until next day (limits reset 00:00 UTC) or sign in at commit.show for higher per-repo caps.

- **Problem:** Score seems too low for a polished library / CLI
  **Solution:** The engine biases toward app form. CLI / library / scaffold gets a partial substitute score capped around 45/50 on the audit pillar. Calibration acknowledged trade-off.

- **Problem:** `concerns[]` is empty after re-running
  **Solution:** Re-audit may have hit cache. Use `--refresh` to force-bypass.

## Related Skills

- `@security-review` — In-session line-level security patterns. Run alongside this skill, not in place of.
- `@vibesec` — Editor-buffer security review for vibe-coded projects. Different lens.
- `@owasp-security` — OWASP Top 10 coverage during coding. Companion.
- `@trail-of-bits-skills` — CodeQL / Semgrep static analysis. Different layer.

## Additional Resources

- Canonical repo: <https://github.com/commitshow/production-audit>
- Audit engine source: <https://github.com/commitshow/commitshow/blob/main/supabase/functions/analyze-project/index.ts>
- 14-frame failure framework documented in the engine source above.
- JSON schema: stable at `schema_version: "1"` · additive-only changes.
- CLI: <https://github.com/commitshow/cli>
- Public REST API: `https://api.commit.show/audit?repo=...&format=json`
- skills.sh listing: <https://skills.sh/commitshow/production-audit>

---

### `skills/cleanup/SKILL.md`

```yaml
---
name: vibe-code-cleanup
description: "Safe production cleanup and hardening for vibe-coded fullstack apps (Next.js, React, Node.js, etc.). Removes dead imports, unused files, and broken references without breaking routes or APIs."
category: fullstack
risk: safe
source: self
source_type: self
date_added: "2026-05-31"
author: Whoisabhishekadhikari
tags: [cleanup, refactor, nextjs, production, vibe-code, fullstack, nodejs]
tools: [claude, cursor, gemini, claude-code]
version: 1.0.0
---
```

# Vibe-Code Cleanup — Production Refactor Skill

A safe, incremental cleanup workflow for AI-generated / vibe-coded fullstack apps.
The goal is to make the codebase production-ready **without** breaking anything that already works.

## When to Use

- Use when a rapidly built app works but has broken imports, duplicated logic, dead code, unclear environment variables, or fragile release hygiene.
- Use before launch or handoff to convert exploratory code into a maintainable production baseline.
- Use when cleanup must preserve existing behavior and avoid broad rewrites of routes, APIs, auth, data models, or integrations.

## Core Philosophy

> **Surgery, not demolition.** Remove only what is provably dead. Preserve everything else.

Never:
- Rewrite working systems for cosmetic reasons
- Rename routes, slugs, or API endpoints that may be indexed or cached
- Change tool inputs/outputs, API contracts, DB schema, or auth flow
- Delete files you haven't verified are unused
- Make broad sweeping changes in a single commit

Always:
- Make small, targeted, reversible changes
- Validate after every meaningful batch of changes
- Prefer shared helpers over copy-pasted blocks
- Keep backward compatibility

---

## Step 1 — Reconnaissance (read before touching)

Before changing anything, map the codebase:

```bash
# List all pages/routes
find . -type f \( -name 'page.js' -o -name 'page.jsx' -o -name 'page.ts' -o -name 'page.tsx' \)
find pages -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) | rg -v '/_' | sort

# Find broken imports (TS projects)
npx tsc --noEmit 2>&1 | head -80

# Find unused exports (optional, for larger projects)
npx ts-prune 2>/dev/null | head -40

# Check for console.log / debug leftovers
grep -r "console\.log\|debugger\|TODO\|FIXME\|HACK" --include="*.{js,ts,jsx,tsx}" -l
```

Document what you find. Do NOT change yet.

---

## Step 2 — Fix Broken Imports First

Broken imports cause build failures and should be fixed before anything else.

```bash
# TypeScript: list all errors
npx tsc --noEmit 2>&1

# Common patterns to fix:
# - Missing file (file was deleted or renamed)
# - Wrong relative path (../lib vs ../../lib)
# - Named export that doesn't exist
```

**Fix rule:** Fix the import reference. Do NOT delete the referenced file unless you've confirmed it's unused everywhere.

---

## Step 3 — Identify Dead Code (verify before removing)

A file/export is safe to remove **only if**:
1. No other file imports it (grep-confirmed)
2. It's not referenced in config, sitemap, or route manifest
3. It's not a public-facing URL (page.js, route.js)

```bash
# Check if a file is imported anywhere
grep -r "from.*my-file\|require.*my-file" --include="*.{js,ts,jsx,tsx}" .

# Check if a component is used anywhere  
grep -r "MyComponent" --include="*.{js,ts,jsx,tsx}" .
```

---

## Step 4 — Consolidate Repeated Logic into Helpers

Look for repeated patterns (metadata blocks, API fetch wrappers, error handlers) that appear in 3+ places.

**Good consolidation targets:**
- Page-level SEO metadata (Open Graph, Twitter cards, canonical)
- Fetch wrappers with error handling
- Repeated utility functions (slugify, formatDate, truncate)

**Bad consolidation targets (leave alone):**
- One-off business logic
- Route handlers with different contracts
- Anything touching DB schema or auth

**Pattern for shared metadata helper (Next.js):**
```js
// lib/socialMetadata.js
export function buildPageMetadata({ title, description, path, image }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.com';
  const imageUrl = image?.startsWith('http') ? image : `${baseUrl}${image}`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}${path}`,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: `${baseUrl}${path}`,
    },
  };
}
```

---

## Step 5 — Environment Variable Audit

```bash
# List all env vars used in code
grep -r "process\.env\." --include="*.{js,ts,jsx,tsx}" . | grep -oP 'process\.env\.\w+' | sort -u

# Compare against .env.example or .env.local
cat .env.example 2>/dev/null || cat .env.local 2>/dev/null
```

Flag any env vars used in code but missing from `.env.example`. Never add secrets to version control.

---

## Step 6 — Validate After Every Batch

Run this after every meaningful batch of cleanup changes:

```bash
# TypeScript check
npx tsc --noEmit

# Lint
npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0

# Build (catches runtime issues TypeScript misses)
npm run build

# Tests (if present)
npm test -- --runInBand --passWithNoTests
```

If build or typecheck breaks → **revert the last batch** before continuing.

---

## Step 7 — Commit Strategy

Each commit should be a single logical unit:

```text
fix: remove broken import in app/blog/page.js
refactor: consolidate social metadata into lib/socialMetadata.js  
chore: remove verified-unused utils/oldHelper.js
fix: standardize env var references to NEXT_PUBLIC_BASE_URL
```

Never bundle UI changes + logic changes + file deletions in one commit. Smaller commits = easier rollback.

---

## What NOT to Clean Up

Treat these as off-limits unless there's a verified bug:

| Area | Why |
|------|-----|
| Route slugs / page paths | May be indexed by Google |
| API route contracts | Callers depend on exact shape |
| DB schema / Prisma models | Migration required |
| Auth flow logic | Security-sensitive |
| Third-party integration configs | Keys/webhooks are environment-specific |
| Working tool pages | User-facing functionality |

---

## Cleanup Checklist

- [ ] TypeScript errors fixed
- [ ] No broken imports
- [ ] Dead code removed (grep-verified)
- [ ] Shared helpers created for repeated patterns (3+ uses)
- [ ] No hardcoded secrets or local-only URLs
- [ ] All env vars documented in `.env.example`
- [ ] Build passes
- [ ] Tests pass (or no tests exist)
- [ ] Lint passes
- [ ] Each commit is scoped and explainable

## Limitations

- Does not infer product intent from code alone; confirm behavior before deleting routes, components, API contracts, or data models.
- Cleanup should be applied in small reviewed batches because broad refactors can hide regressions.
- Avoid changing auth, billing, persistence, or third-party integration behavior without explicit requirements and tests.

---

### `skills/firecrawl-reliability/SKILL.md`

```yaml
---
name: firecrawl-reliability
description: 'Implement Firecrawl reliability patterns: circuit breakers, crawl fallbacks,
  and content validation.

  Use when building fault-tolerant scraping pipelines, implementing crawl-to-scrape
  fallback,

  or adding content quality gates to Firecrawl integrations.

  Trigger with phrases like "firecrawl reliability", "firecrawl circuit breaker",

  "firecrawl fallback", "firecrawl resilience", "firecrawl fault tolerant".

  '
allowed-tools: Read, Write, Edit
version: 1.0.0
license: MIT
author: Jeremy Longshore <jeremy@intentsolutions.io>
tags:
- saas
- firecrawl
- firecrawl-reliability
compatibility: Designed for Claude Code, also compatible with Codex and OpenClaw
---
```

# Firecrawl Reliability Patterns

## API Reference (Firecrawl v2)

This skill calls the Firecrawl API directly. The API key is stored in the agent-kit vault under the name `firecrawl`. All scripts in `../../scripts/firecrawl_*.mjs` read the key via the vault.

| Field | Value |
|---|---|
| API key env var | `FIRECRAWL_API_KEY` (read from agent-kit vault, name: `firecrawl`) |
| Key format | `fc-...`, get yours at https://firecrawl.dev |
| Auth header | `Authorization: Bearer <FIRECRAWL_API_KEY>` |
| Base URL (REST) | `https://api.firecrawl.dev/v2` |
| SDK package | `firecrawl` (npm) or `@mendable/firecrawl-js` (older) |
| Free tier | No key needed for low rate limits; key raises limits |

To set the key in the vault:
```bash
node ~/.cursor/plugins/local/agent-kit/scripts/vault.mjs set firecrawl "fc-YOUR_KEY"
```

### `POST /v2/search` — web search with full content

Request body:
```json
{
  "query": "firecrawl web scraping",
  "limit": 3,
  "scrapeOptions": { "formats": ["markdown"] }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "web": [{ "url": "...", "title": "...", "description": "...", "position": 1 }],
    "images": [...],
    "news": [{ "title": "...", "url": "...", "snippet": "...", "date": "...", "position": 1 }]
  }
}
```

### `POST /v2/scrape` — scrape a single URL

Request body:
```json
{
  "url": "https://example.com",
  "formats": ["markdown", "html", "links"],
  "onlyMainContent": true,
  "includeTags": ["article", "main"],
  "excludeTags": ["nav", "footer"],
  "maxAge": 86400000,
  "timeout": 30000,
  "waitFor": 1000,
  "actions": [{ "type": "click", "selector": "button.load-more" }]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "markdown": "...",
    "html": "...",
    "metadata": {
      "title": "...", "description": "...", "sourceURL": "...",
      "statusCode": 200, "contentType": "text/html",
      "scrapeId": "uuid"
    }
  }
}
```

### `POST /v2/crawl` — recursively crawl a site (async)

Request body:
```json
{
  "url": "https://example.com",
  "limit": 50,
  "scrapeOptions": { "formats": ["markdown"] },
  "includes": ["blog/*"],
  "excludes": ["admin/*"],
  "maxDepth": 3,
  "allowBackwardLinks": false
}
```

Response (202 Accepted):
```json
{ "success": true, "id": "crawl-job-uuid", "url": "https://example.com" }
```

Poll with `GET /v2/crawl/{id}`:
```json
{
  "success": true, "status": "completed",
  "total": 42, "completed": 42, "data": [{ "markdown": "...", "url": "..." }]
}
```

Status: `scraping` → `completed` → (or `failed`).

### `POST /v2/map` — discover all URLs on a site

Request body: `{ "url": "https://example.com", "limit": 100, "search": "optional query" }`
Response: `{ "success": true, "links": ["url1", "url2", ...] }`

### `POST /v2/scrape/{scrapeId}/interact` — interact with a scraped page

First scrape a URL with formats including `markdown` to get a `scrapeId` from the metadata. Then:

```bash
curl -s -X POST "https://api.firecrawl.dev/v2/scrape/$SCRAPE_ID/interact" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Click on the first result and tell me the price"}'
```

Response: `{ "success": true, "output": "...", "exitCode": 0 }`

Stop the session: `DELETE /v2/scrape/{scrapeId}/interact`.

### `POST /v2/agent` — autonomous web data gathering

Long-running task. Body: `{ "task": "Find the price of iPhone 16 Pro Max on Amazon" }`.
Returns: `{ "success": true, "id": "agent-run-uuid" }`.
Poll: `GET /v2/agent/{id}`.

### Webhooks (async event delivery)

Register a webhook URL to receive events when crawl/agent jobs complete. Configure via dashboard or `POST /v2/webhook` with `{ "url": "https://your.endpoint/hook", "events": ["crawl.completed"] }`.

## Error codes

| HTTP | Meaning | Recovery |
|---|---|---|
| 400 | Bad request | Fix body; don't retry |
| 401 | Unauthorized — invalid key | Check vault: `node scripts/vault.mjs get firecrawl` |
| 402 | Payment required — credits exhausted | Buy credits or wait for free-tier reset |
| 403 | Forbidden — access denied | Check plan tier |
| 404 | URL not found (scrape) | Skip URL |
| 408 | Request timeout | Retry once with longer timeout |
| 429 | Rate limited | Read `Retry-After` header, sleep, retry. Max 3 |
| 500, 502, 503 | Server error | Exponential backoff. Max 3 |

## Rate limits + retry

- Free tier (no key): ~1 req/sec, low monthly cap
- Paid tier: higher limits based on plan
- On 429: read `Retry-After`, sleep, retry. Max 3.
- On 408/500/502/503: exponential backoff (1s, 2s, 4s). Max 3.
- On 400/401/402/403/404: do NOT retry.

## Credit-aware usage

Firecrawl charges **credits per page scraped** (1 credit/page on paid tier, free tier has daily cap). To avoid burning credits:
- Use `limit` on `/crawl` to cap pages
- Use `/map` first to discover URLs, then `/scrape` only the ones you need
- Use `onlyMainContent: true` to skip nav/footer noise (also reduces token cost downstream)
- Set `maxAge` to use cached scrapes when freshness allows (saves credits)


## Overview

Production reliability patterns for Firecrawl scraping pipelines. Firecrawl's async crawl model, JS rendering, and credit-based pricing create specific reliability challenges: crawl jobs may time out, scraped content may be empty (bot detection, JS failures), and credits can be burned by runaway crawls. This skill covers battle-tested patterns for each.

## Instructions

### Step 1: Robust Crawl with Timeout and Backoff

```typescript
import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});

async function reliableCrawl(
  url: string,
  opts: { limit: number; paths?: string[] },
  timeoutMs = 600000
) {
  const job = await firecrawl.asyncCrawlUrl(url, {
    limit: opts.limit,
    includePaths: opts.paths,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
  });

  const deadline = Date.now() + timeoutMs;
  let pollInterval = 2000;

  while (Date.now() < deadline) {
    const status = await firecrawl.checkCrawlStatus(job.id);

    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new Error(`Crawl failed: ${status.error}`);
    }

    await new Promise(r => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, 30000); // back off to 30s max
  }

  throw new Error(`Crawl timed out after ${timeoutMs}ms (job: ${job.id})`);
}
```

### Step 2: Content Quality Validation

```typescript
interface ScrapedPage {
  url: string;
  markdown: string;
  metadata: { title?: string; statusCode?: number };
}

function validateContent(page: ScrapedPage): {
  valid: boolean;
  reason?: string;
} {
  if (!page.markdown || page.markdown.length < 100) {
    return { valid: false, reason: "Content too short" };
  }

  if (page.metadata.statusCode && page.metadata.statusCode >= 400) {
    return { valid: false, reason: `HTTP ${page.metadata.statusCode}` };
  }

  const errorPatterns = [
    "access denied", "403 forbidden", "page not found",
    "captcha", "please verify", "enable javascript",
  ];
  const lower = page.markdown.toLowerCase();
  for (const pattern of errorPatterns) {
    if (lower.includes(pattern)) {
      return { valid: false, reason: `Error page detected: "${pattern}"` };
    }
  }

  return { valid: true };
}
```

### Step 3: Crawl-to-Scrape Fallback

```typescript
// If a full crawl fails, fall back to scraping critical pages individually
async function resilientFetch(urls: string[]): Promise<any[]> {
  // Try batch scrape first (most efficient)
  try {
    const batch = await firecrawl.batchScrapeUrls(urls, {
      formats: ["markdown"],
      onlyMainContent: true,
    });

    const results = (batch.data || []).filter(page => {
      const { valid } = validateContent({
        url: page.metadata?.sourceURL || "",
        markdown: page.markdown || "",
        metadata: page.metadata || {},
      });
      return valid;
    });

    if (results.length >= urls.length * 0.5) {
      return results; // batch succeeded (>50% valid)
    }
  } catch (batchError) {
    console.warn("Batch scrape failed, falling back to individual scrapes");
  }

  // Fallback: scrape individually with retries
  const results: any[] = [];
  for (const url of urls) {
    try {
      const result = await firecrawl.scrapeUrl(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 5000,
      });
      if (validateContent({ url, markdown: result.markdown || "", metadata: result.metadata || {} }).valid) {
        results.push(result);
      }
    } catch (e) {
      console.error(`Failed to scrape ${url}: ${(e as Error).message}`);
    }
    // Delay between individual scrapes to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}
```

### Step 4: Circuit Breaker for Firecrawl

```typescript
class FirecrawlCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private threshold: number;
  private resetTimeMs: number;

  constructor(threshold = 5, resetTimeMs = 60000) {
    this.threshold = threshold;
    this.resetTimeMs = resetTimeMs;
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    // Check if circuit should reset
    if (this.state === "open" && Date.now() - this.lastFailure > this.resetTimeMs) {
      this.state = "half-open";
    }

    if (this.state === "open") {
      console.warn("Circuit breaker OPEN — using fallback");
      if (fallback) return fallback();
      throw new Error("Firecrawl circuit breaker is open");
    }

    try {
      const result = await operation();
      if (this.state === "half-open") {
        this.state = "closed";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = "open";
        console.error(`Circuit breaker OPENED after ${this.failures} failures`);
      }
      throw error;
    }
  }
}

const breaker = new FirecrawlCircuitBreaker(5, 60000);

async function protectedScrape(url: string) {
  return breaker.execute(
    () => firecrawl.scrapeUrl(url, { formats: ["markdown"] }),
    () => ({ markdown: getCachedContent(url), metadata: { fromCache: true } })
  );
}
```

### Step 5: Credit-Aware Processing

```typescript
class CreditGuard {
  private dailyUsage = new Map<string, number>();
  private dailyLimit: number;

  constructor(dailyLimit = 5000) {
    this.dailyLimit = dailyLimit;
  }

  canAfford(credits: number): boolean {
    const today = new Date().toISOString().split("T")[0];
    return (this.dailyUsage.get(today) || 0) + credits <= this.dailyLimit;
  }

  record(credits: number) {
    const today = new Date().toISOString().split("T")[0];
    this.dailyUsage.set(today, (this.dailyUsage.get(today) || 0) + credits);
  }

  remaining(): number {
    const today = new Date().toISOString().split("T")[0];
    return this.dailyLimit - (this.dailyUsage.get(today) || 0);
  }
}

const creditGuard = new CreditGuard(5000);

async function budgetedCrawl(url: string, limit: number) {
  if (!creditGuard.canAfford(limit)) {
    throw new Error(`Budget exceeded: ${creditGuard.remaining()} credits remaining`);
  }

  const result = await reliableCrawl(url, { limit });
  creditGuard.record(result.data?.length || 0);
  return result;
}
```

## Error Handling

| Issue | Cause | Solution |
|-------|-------|----------|
| Crawl timeout | Large site, slow rendering | Set timeout, reduce limit |
| Empty markdown | Bot detection or JS failure | Increase `waitFor`, use `actions` |
| Credit overrun | No budget tracking | Implement credit guard |
| Cascade failures | Single scrape failure crashes pipeline | Circuit breaker + fallback |
| Partial crawl results | Some pages blocked | Validate content, retry failed URLs |

## Examples

### Full Resilient Pipeline

```typescript
async function resilientPipeline(url: string) {
  const map = await firecrawl.mapUrl(url);
  const urls = (map.links || []).filter(u => u.includes("/docs/")).slice(0, 50);

  if (!creditGuard.canAfford(urls.length)) {
    console.warn("Budget tight — reducing scope");
    urls.splice(20); // trim to 20
  }

  const pages = await resilientFetch(urls);
  const valid = pages.filter(p => validateContent(p).valid);
  creditGuard.record(urls.length);

  return { scraped: urls.length, valid: valid.length, remaining: creditGuard.remaining() };
}
```

## Resources

- [Firecrawl API Reference](https://docs.firecrawl.dev/api-reference/introduction)
- [Firecrawl Rate Limits](https://docs.firecrawl.dev/rate-limits)

## Next Steps

For policy enforcement, see `firecrawl-policy-guardrails`.

---

### `skills/lib-docs/SKILL.md`

```yaml
---
name: lib-docs
description: Fetch live library/framework/SDK/API documentation via the Context7 REST API. Use when the user asks about a library, framework, SDK, API, CLI tool, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, Spring Boot. Includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI usage. Replaces the context7 MCP server — all calls are made directly to https://context7.com/api/v2/... with the API key stored in the agent-kit vault.
---
```

# Library Docs (Context7)

This skill calls the Context7 REST API directly. No MCP server involved. The API key is stored in the agent-kit vault under the name `context7`. All scripts in `../../scripts/context7_*.mjs` read the key via the vault — never from a raw env var.

## When to invoke

Trigger this skill when the user asks about:
- A library, framework, SDK, API, CLI tool, or cloud service
- Version-specific behavior, migration guides, or breaking changes
- API syntax, configuration, or setup instructions
- "How do I use X?" where X is a named library/framework

Use even when you think you know the answer — your training data may not reflect recent changes. Prefer this skill over `web-search` when the question is specifically about a library/framework's documentation.

Do NOT invoke for:
- Refactoring, writing scripts from scratch, debugging business logic, code review
- General programming concepts (loops, data structures, algorithms)
- Questions about the user's own codebase (use Read/Grep instead)

## Authentication

| Field | Value |
|---|---|
| API key env var | `CONTEXT7_API_KEY` (read from agent-kit vault, name: `context7`) |
| Key format | starts with `ctx7sk-`, get yours at https://context7.com/dashboard |
| Auth header | `Authorization: Bearer <CONTEXT7_API_KEY>` |
| Base URL | `https://context7.com/api` |
| Current version | `v2` (all endpoints under `/api/v2/...` except `/v1/refresh`) |

To set the key in the vault (one-time setup, run once):
```bash
node ~/.cursor/plugins/local/agent-kit/scripts/vault.mjs set context7 "ctx7sk-YOUR_KEY"
```

## Endpoints

### `GET /api/v2/libs/search` — find a library by name

Query params:
- `libraryName` (string, required) — e.g. "react", "next.js", "express"
- `query` (string, optional) — natural language context for ranking, e.g. "I need to manage state"

Auth: optional (higher rate limits with key).

Response:
```json
{
  "results": [
    {
      "id": "/vercel/next.js",
      "title": "Next.js",
      "description": "The React framework for the web",
      "version": "v15.1.8",
      "url": "https://context7.com/vercel/next.js"
    }
  ]
}
```

curl example:
```bash
curl -s "https://context7.com/api/v2/libs/search?libraryName=react&query=manage%20state" \
  -H "Authorization: Bearer $CONTEXT7_API_KEY"
```

### `GET /api/v2/context` — get documentation snippets for a library

Query params:
- `libraryId` (string, required) — e.g. `/vercel/next.js`, `/websites/uploadcare_com`, `/vercel/next.js/v15.1.8`
- `query` (string, required) — natural language question, e.g. "How to implement authentication with middleware"
- `type` (string, optional) — response format: `json` (default) or `txt`
- `tokens` (number, optional) — max tokens to return
- `topic` (string, optional) — focus area, e.g. "hooks", "api/routes"

Auth: optional with key (higher limits, gated content).

Response (type=json):
```json
{
  "codeSnippets": [
    { "codeTitle": "...", "codeList": [{ "code": "...", "language": "..." }] }
  ],
  "infoSnippets": [
    { "content": "..." }
  ]
}
```

Response (type=txt): plain text markdown.

curl example:
```bash
curl -s "https://context7.com/api/v2/context?libraryId=/vercel/next.js&query=How%20to%20implement%20authentication%20with%20middleware&type=json" \
  -H "Authorization: Bearer $CONTEXT7_API_KEY"
```

### `POST /api/v1/refresh` — refresh a library's docs

Auth: **required**.

Body: `{ "libraryId": "/vercel/next.js" }`

Use when docs are stale or after a library releases a new version.

### `GET /api/v2/policies` — get teamspace policy config

Auth: **required**. Returns the teamspace policy configuration.

### `PATCH /api/v2/policies` — update teamspace policies

Auth: **required**. Body: the policy patch.

### `POST /api/v2/add/repo/{provider}` — add a repo

Auth: **required**. Path param `provider` is one of: `github`, `gitlab`, `bitbucket`, `generic`.

Body: `{ "repoUrl": "https://github.com/owner/repo" }`

Returns 409 if the library already exists.

### `POST /api/v2/add/openapi` — add an OpenAPI spec by URL

Auth: **required**. Body: `{ "openApiUrl": "https://..." }`

### `POST /api/v2/add/openapi-upload` — upload an OpenAPI spec file

Auth: **required**. Multipart upload.

### `POST /api/v2/add/llmstxt` — submit an llms.txt file

Auth: **required**. Body: `{ "llmstxtUrl": "https://..." }` or raw content.

### `POST /api/v2/add/website` — submit a website for crawling

Auth: **required**. Body: `{ "websiteUrl": "https://..." }`

### `POST /api/v2/add/confluence` — submit a Confluence space

Auth: **required**. Body includes Confluence space URL + credentials.

## Library ID format

The library ID is the URL path on context7.com. If the library page is at `https://context7.com/websites/uploadcare_com`, the ID is `/websites/uploadcare_com`.

| Source | Example library ID |
|---|---|
| GitHub repository | `/vercel/next.js` |
| GitLab / Bitbucket / generic Git | `//<owner>/<repo>` |
| Website | `/websites/uploadcare_com` |
| llms.txt source | `/llmstxt/<name>` |
| npm / package source | `/packages/<name>` or `/npm/<name>` |
| Uploaded docs | `/docs/<name>` |

**Pin a version** with either:
- `/vercel/next.js/v15.1.8` (path syntax)
- `/vercel/next.js@v15.1.8` (at syntax)

If you don't know the ID, call `/libs/search` first and use the `id` from the response.

## Error codes

| Code | Meaning | Action |
|---|---|---|
| 200 | Success | Process normally |
| 202 | Accepted — library not finalized | Wait and retry later (cold indexing) |
| 301 | Moved — library redirected | Use `redirectUrl` from response as new library ID |
| 400 | Bad request — invalid params | Check query params |
| 401 | Unauthorized — invalid key | Check vault: `node scripts/vault.mjs get context7`. Key must start with `ctx7sk-` |
| 403 | Forbidden — access denied | Check library access permissions or plan tier |
| 404 | Not found — library doesn't exist | Verify the library ID. Call `/libs/search` to resolve |
| 409 | Conflict — already exists | Library has already been added (on `POST /add/...`) |
| 422 | Unprocessable — library too large / no code | Try a different library or subpath |
| 429 | Too many requests — rate limited | Read `Retry-After` header, sleep, retry |
| 500 | Internal server error | Retry with backoff (max 3) |
| 503 | Service unavailable — search failed | Retry later |
| 504 | Gateway timeout — processing timed out | Retry later |

All errors return JSON: `{ "error": "error_code", "message": "human-readable" }`.

For 301 redirects, response also includes `redirectUrl` pointing to the new library ID.

## Rate limits

| Tier | Limits |
|---|---|
| No API key | Low rate limits, no custom config |
| With API key | Higher limits based on plan |

On 429, response headers:
- `Retry-After` — seconds until reset
- `RateLimit-Limit` — total request limit
- `RateLimit-Remaining` — remaining requests in window
- `RateLimit-Reset` — Unix timestamp when limit resets

## Retry policy

```javascript
async function fetchWithRetry(url, headers, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || (2 ** attempt), 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}
```

- **429**: read `Retry-After` header, sleep, retry. Max 3.
- **500/503/504**: exponential backoff (1s, 2s, 4s). Max 3.
- **400/401/403/404/409/422**: do NOT retry — fix the request.

## Scripts provided

| Script | Args | Output |
|---|---|---|
| `scripts/context7_search.mjs` | `<libraryName> [query]` | JSON results to stdout |
| `scripts/context7_query.mjs` | `<libraryId> "<question>" [--type json|txt] [--tokens N]` | JSON or text to stdout |

All scripts:
- Read the API key via the vault (no raw env needed)
- Exit non-zero on error with the API error message in stderr
- Print JSON/text to stdout on success

## Best practices

- **Be specific in queries.** "How to implement authentication with middleware" beats "auth".
- **Resolve IDs first.** Always `/libs/search` if you don't know the exact ID.
- **Pin versions.** Use `/owner/repo/v15.1.8` for version-specific docs.
- **Cache responses.** Docs don't change minute-to-minute; reuse within a session.
- **Handle 202.** New libraries return 202 while indexing — wait and retry.
- **Handle 301.** Use the `redirectUrl` as the new library ID going forward.
- **Use `type=txt`** for plain markdown (easier to display), `type=json`** for structured parsing.

## Common workflow

1. User asks "how do I use X in library Y"
2. Call `/api/v2/libs/search?libraryName=Y&query=X` to resolve the library ID
3. Take the top result's `id` field
4. Call `/api/v2/context?libraryId=<id>&query=<user's question>&type=json`
5. Extract `codeSnippets` and `infoSnippets` from the response
6. Show the user the relevant code + explanation, citing the source URL

## Cost awareness

Context7 charges per request based on plan tier. Search + context is 2 requests per query. Avoid redundant calls — cache the library ID after first resolution. Use `tokens` param to cap response size when you only need a snippet.

## Limitations

- No offline mode — requires network.
- New libraries return 202 while indexing (can take minutes).
- Library must be public on GitHub or already indexed by Context7.
- Private repos require teamspace + paid plan.
- Response size can be large without `tokens` cap.

---

### `skills/refine/SKILL.md`

```yaml
---
name: refine
description: SPARC refinement phase — iterative code improvement via TDD, refactoring, performance tuning, and error-handling hardening. Use when improving existing code quality.
---
```

---
name: refinement
type: developer
color: violet
description: SPARC Refinement phase specialist for iterative improvement
capabilities:
  - code_optimization
  - test_development
  - refactoring
  - performance_tuning
  - quality_improvement
priority: high
sparc_phase: refinement
hooks:
  pre: |
    echo "🔧 SPARC Refinement phase initiated"
    memory_store "sparc_phase" "refinement"
    # Run initial tests
    npm test --if-present || echo "No tests yet"
  post: |
    echo "✅ Refinement phase complete"
    # Run final test suite
    npm test || echo "Tests need attention"
    memory_store "refine_complete_$(date +%s)" "Code refined and tested"
---

# SPARC Refinement Agent

You are a code refinement specialist focused on the Refinement phase of the SPARC methodology. Your role is to iteratively improve code quality through testing, optimization, and refactoring.

## SPARC Refinement Phase

The Refinement phase ensures code quality through:
1. Test-Driven Development (TDD)
2. Code optimization and refactoring
3. Performance tuning
4. Error handling improvement
5. Documentation enhancement

## TDD Refinement Process

### 1. Red Phase - Write Failing Tests

```typescript
// Step 1: Write test that defines desired behavior
describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockUserRepo = createMockRepository();
    mockCache = createMockCache();
    service = new AuthenticationService(mockUserRepo, mockCache);
  });

  describe('login', () => {
    it('should return user and token for valid credentials', async () => {
      // Arrange
      const credentials = {
        email: 'user@example.com',
        password: 'SecurePass123!'
      };
      const mockUser = {
        id: 'user-123',
        email: credentials.email,
        passwordHash: await hash(credentials.password)
      };
      
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await service.login(credentials);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe(mockUser.id);
      expect(mockCache.set).toHaveBeenCalledWith(
        `session:${result.token}`,
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      // This test will fail initially - driving implementation
      const credentials = {
        email: 'user@example.com',
        password: 'WrongPassword'
      };

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await expect(service.login(credentials))
          .rejects.toThrow('Invalid credentials');
      }

      // 6th attempt should indicate locked account
      await expect(service.login(credentials))
        .rejects.toThrow('Account locked due to multiple failed attempts');
    });
  });
});
```

### 2. Green Phase - Make Tests Pass

```typescript
// Step 2: Implement minimum code to pass tests
export class AuthenticationService {
  private failedAttempts = new Map<string, number>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private userRepo: UserRepository,
    private cache: CacheService,
    private logger: Logger
  ) {}

  async login(credentials: LoginDto): Promise<LoginResult> {
    const { email, password } = credentials;

    // Check if account is locked
    const attempts = this.failedAttempts.get(email) || 0;
    if (attempts >= this.MAX_ATTEMPTS) {
      throw new AccountLockedException(
        'Account locked due to multiple failed attempts'
      );
    }

    // Find user
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(
      password,
      user.passwordHash
    );
    if (!isValidPassword) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on successful login
    this.failedAttempts.delete(email);

    // Generate token and create session
    const token = this.generateToken(user);
    const session = {
      userId: user.id,
      email: user.email,
      createdAt: new Date()
    };

    await this.cache.set(
      `session:${token}`,
      session,
      this.SESSION_DURATION
    );

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  private recordFailedAttempt(email: string): void {
    const current = this.failedAttempts.get(email) || 0;
    this.failedAttempts.set(email, current + 1);
    
    this.logger.warn('Failed login attempt', {
      email,
      attempts: current + 1
    });
  }
}
```

### 3. Refactor Phase - Improve Code Quality

```typescript
// Step 3: Refactor while keeping tests green
export class AuthenticationService {
  constructor(
    private userRepo: UserRepository,
    private cache: CacheService,
    private logger: Logger,
    private config: AuthConfig,
    private eventBus: EventBus
  ) {}

  async login(credentials: LoginDto): Promise<LoginResult> {
    // Extract validation to separate method
    await this.validateLoginAttempt(credentials.email);

    try {
      const user = await this.authenticateUser(credentials);
      const session = await this.createSession(user);
      
      // Emit event for other services
      await this.eventBus.emit('user.logged_in', {
        userId: user.id,
        timestamp: new Date()
      });

      return {
        user: this.sanitizeUser(user),
        token: session.token,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      await this.handleLoginFailure(credentials.email, error);
      throw error;
    }
  }

  private async validateLoginAttempt(email: string): Promise<void> {
    const lockInfo = await this.cache.get(`lock:${email}`);
    if (lockInfo) {
      const remainingTime = this.calculateRemainingLockTime(lockInfo);
      throw new AccountLockedException(
        `Account locked. Try again in ${remainingTime} minutes`
      );
    }
  }

  private async authenticateUser(credentials: LoginDto): Promise<User> {
    const user = await this.userRepo.findByEmail(credentials.email);
    if (!user || !await this.verifyPassword(credentials.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  private async handleLoginFailure(email: string, error: Error): Promise<void> {
    if (error instanceof UnauthorizedException) {
      const attempts = await this.incrementFailedAttempts(email);
      
      if (attempts >= this.config.maxLoginAttempts) {
        await this.lockAccount(email);
      }
    }
  }
}
```

## Performance Refinement

### 1. Identify Bottlenecks

```typescript
// Performance test to identify slow operations
describe('Performance', () => {
  it('should handle 1000 concurrent login requests', async () => {
    const startTime = performance.now();
    
    const promises = Array(1000).fill(null).map((_, i) => 
      service.login({
        email: `user${i}@example.com`,
        password: 'password'
      }).catch(() => {}) // Ignore errors for perf test
    );

    await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
  });
});
```

### 2. Optimize Hot Paths

```typescript
// Before: N database queries
async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  const roles = await db.query('SELECT * FROM user_roles WHERE user_id = ?', [userId]);
  const permissions = [];
  
  for (const role of roles) {
    const perms = await db.query('SELECT * FROM role_permissions WHERE role_id = ?', [role.id]);
    permissions.push(...perms);
  }
  
  return permissions;
}

// After: Single optimized query with caching
async function getUserPermissions(userId: string): Promise<string[]> {
  // Check cache first
  const cached = await cache.get(`permissions:${userId}`);
  if (cached) return cached;

  // Single query with joins
  const permissions = await db.query(`
    SELECT DISTINCT p.name
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = ?
  `, [userId]);

  // Cache for 5 minutes
  await cache.set(`permissions:${userId}`, permissions, 300);
  
  return permissions;
}
```

## Error Handling Refinement

### 1. Comprehensive Error Handling

```typescript
// Define custom error hierarchy
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

// Global error handler
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AppError && error.isOperational) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error instanceof ValidationError && { fields: error.fields })
      }
    });
  } else {
    // Unexpected errors
    logger.error('Unhandled error', { error, request: req });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}
```

### 2. Retry Logic and Circuit Breakers

```typescript
// Retry decorator for transient failures
function retry(attempts = 3, delay = 1000) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      let lastError: Error;
      
      for (let i = 0; i < attempts; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          
          if (i < attempts - 1 && isRetryable(error)) {
            await sleep(delay * Math.pow(2, i)); // Exponential backoff
          } else {
            throw error;
          }
        }
      }
      
      throw lastError;
    };
  };
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime 
      && (Date.now() - this.lastFailureTime.getTime()) > this.timeout;
  }
}
```

## Quality Metrics

### 1. Code Coverage
```bash
# Jest configuration for coverage
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coveragePathIgnorePatterns: [
    '$node_modules/',
    '$test/',
    '$dist/'
  ]
};
```

### 2. Complexity Analysis
```typescript
// Keep cyclomatic complexity low
// Bad: Complexity = 7
function processUser(user: User): void {
  if (user.age > 18) {
    if (user.country === 'US') {
      if (user.hasSubscription) {
        // Process premium US adult
      } else {
        // Process free US adult
      }
    } else {
      if (user.hasSubscription) {
        // Process premium international adult
      } else {
        // Process free international adult
      }
    }
  } else {
    // Process minor
  }
}

// Good: Complexity = 2
function processUser(user: User): void {
  const processor = getUserProcessor(user);
  processor.process(user);
}

function getUserProcessor(user: User): UserProcessor {
  const type = getUserType(user);
  return ProcessorFactory.create(type);
}
```

## Best Practices

1. **Test First**: Always write tests before implementation
2. **Small Steps**: Make incremental improvements
3. **Continuous Refactoring**: Improve code structure continuously
4. **Performance Budgets**: Set and monitor performance targets
5. **Error Recovery**: Plan for failure scenarios
6. **Documentation**: Keep docs in sync with code

Remember: Refinement is an iterative process. Each cycle should improve code quality, performance, and maintainability while ensuring all tests remain green.

---

### `skills/web-search/SKILL.md`

```yaml
---
name: web-search
description: Search the web, fetch page contents, and get cited answers via the Exa API. Use when the user asks about current information, recent events, library docs that may have changed, code examples, or specific URLs. Replaces the exa MCP server — all calls are made directly via the Exa REST API or exa-js SDK, with the API key stored in the agent-kit vault.
---
```

# Web Search (Exa)

This skill calls the Exa API directly. No MCP server involved. The API key is stored in the agent-kit vault under the name `exa`. All scripts in `../../scripts/exa_*.mjs` read the key via the vault — never from a raw env var.

## When to invoke

Trigger this skill when the user:
- Asks about recent events, news, or anything that may have changed since training data
- Needs current library/framework/SDK/API/CLI documentation
- Shares a URL or asks about a specific webpage (use `getContents`)
- Needs code snippets, API documentation, or library usage examples
- Asks a factual question where a cited answer is preferable to a generated one (use `answer`)
- Asks for "research" on a topic that needs multiple sources synthesized (use `research.create` + `research.pollUntilFinished`)

Do NOT invoke for:
- Refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts
- Questions about the user's own codebase (use Read/Grep instead)
- Anything answerable from training data with high confidence AND no recent-change risk

## Authentication

| Field | Value |
|---|---|
| API key env var | `EXA_API_KEY` (read from agent-kit vault, name: `exa`) |
| Key format | hex string, get yours at https://exa.ai/dashboard |
| Header name | `x-api-key` |
| Base URL (REST) | `https://api.exa.ai` |
| SDK package | `exa-js` (npm, MIT, latest 2.16.0 as of Jul 2026) |
| SDK constructor | `new Exa(process.env.EXA_API_KEY)` — reads `EXA_API_KEY` from env if no arg |

To set the key in the vault (one-time setup, run once):
```bash
node ~/.cursor/plugins/local/agent-kit/scripts/vault.mjs set exa "YOUR_EXA_API_KEY"
```

## REST endpoints (use directly with `fetch`)

### `POST /search` — web search with optional content

Request body:
```json
{
  "query": "string (required)",
  "type": "auto | fast | deep-lite | deep | deep-reasoning | instant",
  "numResults": 10,
  "includeDomains": ["example.com"],
  "excludeDomains": ["spam.com"],
  "startPublishedDate": "2024-01-01",
  "endPublishedDate": "2024-12-31",
  "maxAgeHours": 168,
  "contents": {
    "text": { "maxCharacters": 4000, "includeHtmlTags": false },
    "highlights": { "numSentences": 3, "query": "optional focus" },
    "summary": { "query": "optional focus" },
    "livecrawl": "fallback | always | never"
  },
  "outputSchema": { "type": "object", "properties": { ... } },
  "systemPrompt": "string to guide synthesized output"
}
```

Response:
```json
{
  "results": [
    {
      "title": "string",
      "id": "url", "url": "url",
      "publishedDate": "ISO-8601", "author": "string|null",
      "score": 0.92,
      "text": "full text if requested",
      "highlights": ["..."], "highlightScores": [0.84],
      "summary": "string if requested"
    }
  ],
  "requestId": "string",
  "statuses": [{ "id": "url", "status": "success" }],
  "costDollars": { ... },
  "output": { "content": "...", "grounding": [...] }
}
```

curl example:
```bash
curl -s -X POST "https://api.exa.ai/search" \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"latest Next.js 15 features","numResults":5,"contents":{"highlights":true}}'
```

### `POST /contents` — fetch content for known URLs

Request body:
```json
{
  "urls": ["https://example.com/a", "https://example.com/b"],
  "text": { "maxCharacters": 4000, "includeHtmlTags": false },
  "highlights": { "numSentences": 3, "query": "focus" },
  "summary": { "query": "focus" },
  "livecrawl": "fallback"
}
```

Response: same shape as `/search` `results` array.

curl example:
```bash
curl -s -X POST "https://api.exa.ai/contents" \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://docs.exa.ai"],"text":{"maxCharacters":4000}}'
```

### `POST /answer` — synthesized cited answer

Request body:
```json
{
  "query": "What is the capital of France?",
  "text": true,
  "model": "exa",
  "systemPrompt": "optional",
  "outputSchema": { "type": "object", "properties": { ... } },
  "userLocation": "optional"
}
```

Response:
```json
{
  "answer": "The capital of France is Paris.",
  "citations": [{ "id": "url", "url": "url", "title": "...", "text": "..." }],
  "requestId": "string",
  "costDollars": { ... }
}
```

### `POST /findSimilar` (deprecated, still works)

Request body:
```json
{
  "url": "https://example.com/article",
  "numResults": 10,
  "excludeSourceDomain": true,
  "contents": { "text": true }
}
```

### Research endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/research` | POST | Create async research task (model: `exa-research`) |
| `/research/{id}` | GET | Get status + output. `?stream=true` for SSE |
| `/research` | GET | List research tasks (`?limit=10&cursor=...`) |

`POST /research` body: `{ "instructions": "...", "model": "exa-research", "outputSchema": {...} }`
Returns: `{ "researchId": "uuid", "status": "pending" }`

`GET /research/{id}` returns:
```json
{
  "researchId": "uuid", "status": "completed",
  "instructions": "...",
  "output": { "parsed": { ... matches outputSchema ... } }
}
```

## SDK equivalents (exa-js)

```typescript
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);

// Search
const r1 = await exa.search("query", { type: "auto", numResults: 10, contents: { highlights: true } });

// Get contents
const r2 = await exa.getContents(["url1", "url2"], { text: { maxCharacters: 4000 } });

// Cited answer
const { answer, citations } = await exa.answer("question", { text: true, model: "exa" });

// Find similar (deprecated)
const r4 = await exa.findSimilar("https://url", { numResults: 10, contents: { text: true } });

// Research — async
const task = await exa.research.create({ instructions: "...", model: "exa-research" });
const result = await exa.research.pollUntilFinished(task.researchId, { pollInterval: 1000, timeoutMs: 600000 });

// Streaming answer
for await (const chunk of exa.streamAnswer("question", { text: true, model: "exa" })) {
  if (chunk.content) process.stdout.write(chunk.content);
  if (chunk.citations) console.log(chunk.citations);
}
```

## Search type selection

| `type` | Use when |
|---|---|
| `auto` | Default. Best balance. Start here. |
| `fast` | Latency-sensitive. Simpler queries. |
| `instant` | Lowest latency, real-time. |
| `deep-lite` | More thorough than fast, less cost than deep. |
| `deep` | Complex research queries. |
| `deep-reasoning` | Multi-step reasoning + `outputSchema` for structured research output. |

## Error codes

| HTTP | Meaning | Recovery |
|---|---|---|
| 400 | Bad request — invalid params | Fix the body; don't retry |
| 401 | Unauthorized — missing/invalid key | Check vault: `node scripts/vault.mjs get exa` |
| 402 | Payment required — quota exhausted | Upgrade plan or wait for reset |
| 404 | URL not found (on `/contents`) | Skip the URL |
| 422 | Unprocessable — bad `outputSchema` | Fix schema shape |
| 429 | Rate limited | Exponential backoff. Headers: `Retry-After`, `X-RateLimit-Reset` |
| 500, 502, 503 | Server error | Retry with backoff (max 3) |

## Rate limits + retry policy

- Per-key rate limit depends on plan. Check dashboard.
- On 429: read `Retry-After` header (seconds), sleep that long, retry. Max 3 retries.
- On 500/502/503: exponential backoff (1s, 2s, 4s). Max 3 retries.
- On 401/402/400/422: do NOT retry — fix the request or auth.

## Scripts provided

| Script | Args | Output |
|---|---|---|
| `scripts/exa_search.mjs` | `<query> [numResults] [--json]` | JSON results to stdout |
| `scripts/exa_fetch.mjs` | `<url1> [url2...] [--json]` | JSON contents to stdout |
| `scripts/exa_answer.mjs` | `<question>` | `{answer, citations}` JSON to stdout |

All scripts:
- Read the API key via the vault (no raw env needed)
- Exit non-zero on error
- Print the API error message to stderr
- Print JSON to stdout on success

## Best practices

- **Start with `/search`** — it returns URLs + optional content in one call.
- **Use `/contents`** only when you already have URLs (e.g. from search results).
- **Use `/answer`** when the user wants a synthesized answer with citations, not a link list.
- **Use `outputSchema`** for structured extraction — Exa will synthesize results into your schema.
- **Pin freshness with `maxAgeHours`** (preferred) or `startPublishedDate` for "last week" queries.
- **Use `includeDomains`** to scope to trusted sources (e.g. official docs).
- **Cache responses** — Exa results don't change minute-to-minute; reuse within a session.

## Cost awareness

Exa charges per request and per content fetched. Deep search types cost more. Be specific in queries to reduce wasted calls. Use `numResults: 5` by default; raise only when the user needs breadth.

## Limitations

- No offline mode — requires network.
- Free tier has low rate limits; for production use, paid tier needed.
- `findSimilar` is deprecated — prefer `/search` with `includeDomains`.
- Research API is async — `pollUntilFinished` blocks up to `timeoutMs` (default 10 min).

---

### `skills/xlsx/SKILL.md`

```yaml
---
name: xlsx
description: "Spreadsheet toolkit (.xlsx/.csv). Create/edit with formulas/formatting, analyze data, visualization, recalculate formulas, for spreadsheet processing and analysis."
license: Proprietary. LICENSE.txt has complete terms
---
```

# Requirements for Outputs

## All Excel files

### Zero Formula Errors
- Every Excel model MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

### Preserve Existing Templates (when updating templates)
- Study and EXACTLY match existing format, style, and conventions when modifying files
- Never impose standardized formatting on files with established patterns
- Existing template conventions ALWAYS override these guidelines

## Financial models

### Color Coding Standards
Unless otherwise stated by the user or existing template

#### Industry-Standard Color Conventions
- **Blue text (RGB: 0,0,255)**: Hardcoded inputs, and numbers users will change for scenarios
- **Black text (RGB: 0,0,0)**: ALL formulas and calculations
- **Green text (RGB: 0,128,0)**: Links pulling from other worksheets within same workbook
- **Red text (RGB: 255,0,0)**: External links to other files
- **Yellow background (RGB: 255,255,0)**: Key assumptions needing attention or cells that need to be updated

### Number Formatting Standards

#### Required Format Rules
- **Years**: Format as text strings (e.g., "2024" not "2,024")
- **Currency**: Use $#,##0 format; ALWAYS specify units in headers ("Revenue ($mm)")
- **Zeros**: Use number formatting to make all zeros "-", including percentages (e.g., "$#,##0;($#,##0);-")
- **Percentages**: Default to 0.0% format (one decimal)
- **Multiples**: Format as 0.0x for valuation multiples (EV/EBITDA, P/E)
- **Negative numbers**: Use parentheses (123) not minus -123

### Formula Construction Rules

#### Assumptions Placement
- Place ALL assumptions (growth rates, margins, multiples, etc.) in separate assumption cells
- Use cell references instead of hardcoded values in formulas
- Example: Use =B5*(1+$B$6) instead of =B5*1.05

#### Formula Error Prevention
- Verify all cell references are correct
- Check for off-by-one errors in ranges
- Ensure consistent formulas across all projection periods
- Test with edge cases (zero values, negative numbers)
- Verify no unintended circular references

#### Documentation Requirements for Hardcodes
- Comment or in cells beside (if end of table). Format: "Source: [System/Document], [Date], [Specific Reference], [URL if applicable]"
- Examples:
  - "Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]"
  - "Source: Company 10-Q, Q2 2025, Exhibit 99.1, [SEC EDGAR URL]"
  - "Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity"
  - "Source: FactSet, 8/20/2025, Consensus Estimates Screen"

# XLSX creation, editing, and analysis

## Overview

Create, edit, or analyze Excel spreadsheets with formulas, formatting, and data analysis. Apply this skill for spreadsheet processing using openpyxl and pandas. Recalculate formulas and ensure zero errors for publication-quality outputs.

## Visual Enhancement with Scientific Schematics

**When creating documents with this skill, always consider adding scientific diagrams and schematics to enhance visual communication.**

If your document does not already contain schematics or diagrams:
- Use the **scientific-schematics** skill to generate AI-powered publication-quality diagrams
- Simply describe your desired diagram in natural language
- Nano Banana Pro will automatically generate, review, and refine the schematic

**For new documents:** Scientific schematics should be generated by default to visually represent key concepts, workflows, architectures, or relationships described in the text.

**How to generate schematics:**
```bash
python scripts/generate_schematic.py "your diagram description" -o figures/output.png
```

The AI will automatically:
- Create publication-quality images with proper formatting
- Review and refine through multiple iterations
- Ensure accessibility (colorblind-friendly, high contrast)
- Save outputs in the figures/ directory

**When to add schematics:**
- Spreadsheet workflow diagrams
- Data processing pipeline illustrations
- Formula calculation flow diagrams
- Financial model structure diagrams
- Data analysis flowcharts
- Any complex concept that benefits from visualization

For detailed guidance on creating schematics, refer to the scientific-schematics skill documentation.

---

## Important Requirements

**LibreOffice Required for Formula Recalculation**: You can assume LibreOffice is installed for recalculating formula values using the `recalc.py` script. The script automatically configures LibreOffice on first run

## Reading and analyzing data

### Data analysis with pandas
For data analysis, visualization, and basic operations, use **pandas** which provides powerful data manipulation capabilities:

```python
import pandas as pd

# Read Excel
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
df.head()      # Preview data
df.info()      # Column info
df.describe()  # Statistics

# Write Excel
df.to_excel('output.xlsx', index=False)
```

## Excel File Workflows

## CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating values in Python and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

### ❌ WRONG - Hardcoding Calculated Values
```python
# Bad: Calculating in Python and hardcoding result
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcodes 5000

# Bad: Computing growth rate in Python
growth = (df.iloc[-1]['Revenue'] - df.iloc[0]['Revenue']) / df.iloc[0]['Revenue']
sheet['C5'] = growth  # Hardcodes 0.15

# Bad: Python calculation for average
avg = sum(values) / len(values)
sheet['D20'] = avg  # Hardcodes 42.5
```

### ✅ CORRECT - Using Excel Formulas
```python
# Good: Let Excel calculate the sum
sheet['B10'] = '=SUM(B2:B9)'

# Good: Growth rate as Excel formula
sheet['C5'] = '=(C4-C2)/C2'

# Good: Average using Excel function
sheet['D20'] = '=AVERAGE(D2:D19)'
```

This applies to ALL calculations - totals, percentages, ratios, differences, etc. The spreadsheet should be able to recalculate when source data changes.

## Common Workflow
1. **Choose tool**: pandas for data, openpyxl for formulas/formatting
2. **Create/Load**: Create new workbook or load existing file
3. **Modify**: Add/edit data, formulas, and formatting
4. **Save**: Write to file
5. **Recalculate formulas (MANDATORY IF USING FORMULAS)**: Use the recalc.py script
   ```bash
   python recalc.py output.xlsx
   ```
6. **Verify and fix any errors**: 
   - The script returns JSON with error details
   - If `status` is `errors_found`, check `error_summary` for specific error types and locations
   - Fix the identified errors and recalculate again
   - Common errors to fix:
     - `#REF!`: Invalid cell references
     - `#DIV/0!`: Division by zero
     - `#VALUE!`: Wrong data type in formula
     - `#NAME?`: Unrecognized formula name

### Creating new Excel files

```python
# Using openpyxl for formulas and formatting
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'
sheet.append(['Row', 'of', 'data'])

# Add formula
sheet['B2'] = '=SUM(A1:A10)'

# Formatting
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

# Column width
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
```

### Editing existing Excel files

```python
# Using openpyxl to preserve formulas and formatting
from openpyxl import load_workbook

# Load existing file
wb = load_workbook('existing.xlsx')
sheet = wb.active  # or wb['SheetName'] for specific sheet

# Working with multiple sheets
for sheet_name in wb.sheetnames:
    sheet = wb[sheet_name]
    print(f"Sheet: {sheet_name}")

# Modify cells
sheet['A1'] = 'New Value'
sheet.insert_rows(2)  # Insert row at position 2
sheet.delete_cols(3)  # Delete column 3

# Add new sheet
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
```

## Recalculating formulas

Excel files created or modified by openpyxl contain formulas as strings but not calculated values. Use the provided `recalc.py` script to recalculate formulas:

```bash
python recalc.py <excel_file> [timeout_seconds]
```

Example:
```bash
python recalc.py output.xlsx 30
```

The script:
- Automatically sets up LibreOffice macro on first run
- Recalculates all formulas in all sheets
- Scans ALL cells for Excel errors (#REF!, #DIV/0!, etc.)
- Returns JSON with detailed error locations and counts
- Works on both Linux and macOS

## Formula Verification Checklist

Quick checks to ensure formulas work correctly:

### Essential Verification
- [ ] **Test 2-3 sample references**: Verify they pull correct values before building full model
- [ ] **Column mapping**: Confirm Excel columns match (e.g., column 64 = BL, not BK)
- [ ] **Row offset**: Remember Excel rows are 1-indexed (DataFrame row 5 = Excel row 6)

### Common Pitfalls
- [ ] **NaN handling**: Check for null values with `pd.notna()`
- [ ] **Far-right columns**: FY data often in columns 50+ 
- [ ] **Multiple matches**: Search all occurrences, not just first
- [ ] **Division by zero**: Check denominators before using `/` in formulas (#DIV/0!)
- [ ] **Wrong references**: Verify all cell references point to intended cells (#REF!)
- [ ] **Cross-sheet references**: Use correct format (Sheet1!A1) for linking sheets

### Formula Testing Strategy
- [ ] **Start small**: Test formulas on 2-3 cells before applying broadly
- [ ] **Verify dependencies**: Check all cells referenced in formulas exist
- [ ] **Test edge cases**: Include zero, negative, and very large values

### Interpreting recalc.py Output
The script returns JSON with error details:
```json
{
  "status": "success",           // or "errors_found"
  "total_errors": 0,              // Total error count
  "total_formulas": 42,           // Number of formulas in file
  "error_summary": {              // Only present if errors found
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    }
  }
}
```

## Best Practices

### Library Selection
- **pandas**: Best for data analysis, bulk operations, and simple data export
- **openpyxl**: Best for complex formatting, formulas, and Excel-specific features

### Working with openpyxl
- Cell indices are 1-based (row=1, column=1 refers to cell A1)
- Use `data_only=True` to read calculated values: `load_workbook('file.xlsx', data_only=True)`
- **Warning**: If opened with `data_only=True` and saved, formulas are replaced with values and permanently lost
- For large files: Use `read_only=True` for reading or `write_only=True` for writing
- Formulas are preserved but not evaluated - use recalc.py to update values

### Working with pandas
- Specify data types to avoid inference issues: `pd.read_excel('file.xlsx', dtype={'id': str})`
- For large files, read specific columns: `pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])`
- Handle dates properly: `pd.read_excel('file.xlsx', parse_dates=['date_column'])`

## Code Style Guidelines
**IMPORTANT**: When generating Python code for Excel operations:
- Write minimal, concise Python code without unnecessary comments
- Avoid verbose variable names and redundant operations
- Avoid unnecessary print statements

**For Excel files themselves**:
- Add comments to cells with complex formulas or important assumptions
- Document data sources for hardcoded values
- Include notes for key calculations and model sections

---
