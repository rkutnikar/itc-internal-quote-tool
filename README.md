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

Vercel's serverless filesystem is ephemeral/read-only, so anything saved on the Settings screen does not survive there. Set env vars instead — they always override the settings file:

| Var | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | **yes** | 32+ random chars (`openssl rand -hex 32`); signs the login cookie, encrypts settings |
| `APP_PASSWORD` | **yes** | Shared login password |
| `FRAPPE_URL` | yes* | e.g. `https://yourco.frappe.cloud` |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | yes* | From the Frappe service user (see fixtures README) |
| `DATA_DIR` | no | Override local data path (e.g. `/tmp/itc-data` for scratch persistence within a warm instance) |

\* Without Frappe vars the app runs in sample-data mode and quotes can't persist on Vercel (read-only fs) — fine for a demo deploy, not for real use. **On Vercel, connect Frappe so quotes are stored there.**

Deploy checklist:
1. Push this repo to GitHub, import into Vercel (framework auto-detected: Next.js). No `vercel.json` needed.
2. Add the env vars above (Production + Preview).
3. Complete the Frappe setup in [frappe-fixtures/README.md](./frappe-fixtures/README.md) (service user, custom fields, doctype).
4. Open the deployed app → log in with `APP_PASSWORD` → Settings → Run Connection Test → all green.
5. Pricing Rules and Quote Document settings: on Vercel these currently reset per deploy unless set before build — tune them and keep Frappe as the source of quotes; a Frappe-side settings doc is the planned follow-up if this pinches.

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
