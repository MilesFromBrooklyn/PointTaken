# Benefit Tracker — Design Spec
*Date: 2026-04-12*

## Overview

A new `/tracker` page added to the existing PointTaken site that lets a user build a "wallet" of cards they own, track which benefits they've used each period, and see a "use it or lose it" alert for credits expiring soon. Authenticated via Supabase so the wallet syncs across devices.

---

## Architecture

The project migrates from a single `index.html` to a Vite-based multi-page static site. GitHub Pages continues to serve it via a deploy workflow that runs `vite build`.

```
PointTaken/
├── index.html              ← card finder entry point (unchanged in behavior)
├── tracker.html            ← benefit tracker entry point
├── src/
│   ├── cards.js            ← card + benefit data extracted from index.html
│   ├── main.js             ← card finder logic (extracted from index.html)
│   ├── tracker.js          ← tracker UI logic
│   └── supabase.js         ← Supabase client initialization
├── .env                    ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
├── .env.example            ← committed placeholder for onboarding
├── vite.config.js          ← multi-page input config (index + tracker)
└── .github/workflows/
    └── deploy.yml          ← vite build + deploy to GitHub Pages
```

**Key decision:** Card and benefit data is extracted from `index.html` into `src/cards.js` so both pages share a single source of truth. No duplication.

---

## Data Model (Supabase)

Auth is handled entirely by Supabase's built-in `auth.users` table. Two additional tables are created in the public schema, both protected by Row Level Security so users can only access their own rows.

### `user_cards`
Stores which cards are in the user's wallet.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `user_id` | uuid FK → auth.users | |
| `card_id` | text | matches `id` field in `cards.js` (e.g. `"csr"`, `"amex-plat"`) |
| `anniversary_day` | integer | 1–28, day of month the card was opened |
| `anniversary_month` | integer | 1–12, month the card was opened |
| `added_at` | timestamptz | default now() |

### `benefit_usage`
Records when a benefit has been used in a given period. A benefit is "available" when no row exists for the current period.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `user_id` | uuid FK → auth.users | |
| `card_id` | text | |
| `benefit_name` | text | exact name string from `cards.js` (e.g. `"$120 Lyft Credit"`) |
| `period_key` | text | `"YYYY-MM"` for monthly benefits; `"YYYY"` for annual (see reset logic) |
| `used_at` | timestamptz | default now() |

**Unique constraint:** `(user_id, card_id, benefit_name, period_key)` — prevents duplicate usage rows.

### Reset Logic (client-side, no cron)

- **Monthly benefits:** `period_key = YYYY-MM` of the current date. Resets naturally on the 1st of each month since the month changes.
- **Annual benefits:** `period_key = YYYY` of the anniversary cycle start. If a card's anniversary is in March, the cycle runs March–February. The period year is the year the current cycle began (e.g. a card opened March 2023: in January 2026, the cycle started March 2025, so `period_key = "2025"`).

Marking a benefit used = insert a row. Unmarking = delete that row. No scheduled jobs needed.

---

## UI — Pages & Components

### Auth Screen (unauthenticated)
Shown when no Supabase session exists. Centered card with:
- Email + password fields
- Toggle between "Sign up" and "Log in"
- "Email me a magic link" option (passwordless)
- Matches existing PointTaken visual style (forest/parchment palette, Instrument Serif + Lato)

### My Wallet (card selection)
Shown on first login (empty wallet) and accessible via "Edit Wallet" button on the dashboard. Contains:
- Searchable/filterable list of all cards from `cards.js`
- Each card has a checkbox (owned / not owned)
- When checked, prompts for anniversary month and day
- Saves to `user_cards` on confirm

### Benefit Dashboard (main view)
The primary view once the wallet has cards. Layout:
- One collapsible section per card
- Section header: card name, issuer, summary bar (e.g. `$130 of $420 used this month`)
- Each benefit row:
  - Benefit name + description
  - Reset cadence badge: `monthly` or `annual`
  - Dollar value
  - Checkbox — toggles used/available for the current period
  - Used benefits are visually dimmed
- "Edit Wallet" button in the page header

### "Use It or Lose It" Panel
Sticky/prominent section at the top of the dashboard. Shows only unused benefits whose current period expires within 7 days:
- Monthly benefits: shown when today is the 25th or later
- Annual benefits: shown when today is within 7 days of the user's anniversary date for that card
- Sorted by days remaining (most urgent first)
- Each row links to the benefit in the dashboard below
- Hidden entirely when no benefits are expiring soon

### Navigation
A "My Tracker" link is added to the existing `index.html` header, pointing to `/tracker`. Style matches existing nav links.

---

## Auth Flow

1. User visits `/tracker` — Supabase session checked on load.
2. No session → Auth screen shown.
3. On successful login/signup → redirect to `/tracker` with session established.
4. Session persists via Supabase's built-in localStorage token management.
5. "Sign out" button in the tracker header.

---

## GitHub Pages Deployment

The existing manual `index.html` commits are replaced with a GitHub Actions workflow:

```yaml
# .github/workflows/deploy.yml
- run: npm ci
- run: npm run build      # vite build → dist/
- uses: actions/deploy-pages@v4
  with: path: dist
```

The Supabase anon key and URL are stored as GitHub Actions secrets and injected as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build time.

---

## Out of Scope

- Push/email notifications for expiring benefits (can be added later via Supabase Edge Functions)
- Manual override of reset dates
- Sharing your wallet with others
- Tracking points/rewards earned (separate from benefit credits)
