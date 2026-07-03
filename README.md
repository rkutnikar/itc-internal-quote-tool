# ITC Quote Tool

Internal webapp for generating client quotations when deploying internal/external consultants. Backed by an existing Frappe/ERPNext site; deployable on Vercel.

Full plan: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) · Frappe setup: [frappe-fixtures/README.md](./frappe-fixtures/README.md)

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — first visit asks you to **set the shared team password** (stored as a scrypt hash in the encrypted local settings file). Then go to **Settings**, enter your Frappe URL + API key/secret, and hit **Run Connection Test**.

No environment variables are required locally: settings (including Frappe credentials) are stored encrypted in `data/settings.enc` (gitignored), with the encryption secret auto-generated in `data/secret`.

## Deploying to Vercel

Vercel's serverless filesystem is read-only, so the app needs **Vercel Blob** for storage (settings, shared password, quotes-before-Frappe). One-time setup:

1. Push this repo to GitHub, import into Vercel (framework auto-detected: Next.js). No `vercel.json` needed.
2. Vercel dashboard → your project → **Storage → Create Database → Blob** → create. This injects `BLOB_READ_WRITE_TOKEN` automatically — the app detects it and stores its two encrypted blobs there instead of on disk.
3. Add env var `SESSION_SECRET` (32+ random chars, `openssl rand -hex 32`) — keeps logins valid across serverless instances.
4. Redeploy. First visit now shows the set-password screen, and every Settings section saves and persists — same behavior as local.
5. When connecting Frappe: complete [frappe-fixtures/README.md](./frappe-fixtures/README.md), then enter URL + keys in Settings → Run Connection Test.

Optional env vars (each overrides the stored setting):

| Var | Purpose |
|---|---|
| `APP_PASSWORD` | Shared login password (instead of the first-run screen) |
| `FRAPPE_URL`, `FRAPPE_API_KEY`, `FRAPPE_API_SECRET` | Frappe connection (instead of the Settings screen) |
| `DATA_DIR` | Override local data path (dev only) |

Storage resolution: Blob store when `BLOB_READ_WRITE_TOKEN` exists, else local `data/` directory. Blob contents are AES-256-GCM encrypted with a key derived from `SESSION_SECRET` — changing that secret orphans previously saved data.

## First-run walkthrough (5 minutes)

1. `npm run dev` → http://localhost:3000 → set the shared team password.
2. Settings → **Pricing Rules**: tune tier multipliers, experience bands, priority discounts, minimum margin. The "Try it" panel shows the effect live.
3. Settings → **Quote Document**: company name, address, terms, discount visibility.
4. (Optional now, required for real data) Settings → **Frappe Connection** → URL + API key/secret → **Run Connection Test**.
5. **New Quote** → pick client (sample data until Frappe is connected) → requirement → resource → pricing slider → review → save.
6. Quote page → **Download PDF** (3 signature blocks: Recruiter, Finance Manager, Director) → mark **Sent/Approved/Rejected** as it progresses. **Dashboard** tracks pipeline, win rate and markup; expired quotes flip automatically.

## Security model

- Frappe credentials live server-side only (env vars or encrypted file); every Frappe call goes through Next.js route handlers.
- Shared-password login via signed httpOnly cookie (iron-session, 12h TTL).
- Local settings file is AES-256-GCM encrypted; secret file is `0600`.

## Roadmap

- **Phase 0** ✅ — scaffold, auth, settings + Frappe connection test, fixtures
- **Phase 1** ✅ — pricing engine (CTC × multiplier, Good/Better/Best, min-bill floor) + pricing settings (`npm test` covers the engine)
- **Phase 2** ✅ — 4-step quote wizard, quotes list/detail, mock-data mode (works before Frappe is connected), local quote store with Frappe fallback
- **Phase 3** ✅ — PDF generation (placeholder template with 3 signature blocks; swap to the real template is layout-only in `src/lib/pdf.ts`), auto-attach to the Frappe quote record
- **Phase 4** ✅ — dashboard KPIs + funnel + trend, quote lifecycle (Sent/Approved/Rejected, automatic expiry), revision cloning, status filters, Frappe status sync
- **Phase 5** ✅ — responsive/polish pass, read-only-fs hardening, deploy checklist

Open items: real PDF template (drop into `src/lib/pdf.ts`), production multiplier numbers (Settings → Pricing Rules).
