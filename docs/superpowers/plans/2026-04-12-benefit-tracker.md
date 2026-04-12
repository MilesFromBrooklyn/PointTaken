# Benefit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/tracker` page to PointTaken where authenticated users can build a wallet of their credit cards, mark benefits as used each period, and see a "Use It or Lose It" alert for credits expiring soon.

**Architecture:** Migrate the existing single-file `index.html` to a Vite multi-page app, extracting card data to a shared `src/cards.js` module. Add `tracker.html` as a second entry point backed by `src/tracker.js`, which uses the Supabase JS SDK for auth and two Postgres tables (`user_cards`, `benefit_usage`) with Row Level Security.

**Tech Stack:** Vite 6, Supabase JS v2, Vitest, vanilla JS (no framework), GitHub Actions for deploy

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Create | npm scripts: dev, build, test |
| `vite.config.js` | Create | Multi-page input (index + tracker) |
| `.env.example` | Create | Supabase key placeholders |
| `.gitignore` | Modify | Add `node_modules/`, `dist/`, `.env` |
| `src/cards.js` | Create | Extracted `CARDS`, `BROWSE_CATS`, `TAG_META` from index.html |
| `src/main.js` | Create | Card finder logic extracted from index.html |
| `src/supabase.js` | Create | Supabase client singleton |
| `src/tracker-utils.js` | Create | Pure functions: period key, expiry logic |
| `src/tracker-utils.test.js` | Create | Vitest tests for tracker-utils |
| `src/tracker.js` | Create | Tracker UI: auth, wallet, dashboard |
| `tracker.html` | Create | Tracker entry point (styles + `#app` div) |
| `index.html` | Modify | Remove inline `<script>`, add module script tag + nav link |
| `.github/workflows/deploy.yml` | Create/Replace | Vite build + GitHub Pages deploy |

---

## Task 1: Initialize Vite Project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "point-taken",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.4"
  },
  "devDependencies": {
    "vite": "^6.3.2",
    "vitest": "^3.1.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tracker: resolve(__dirname, 'tracker.html'),
      },
    },
  },
});
```

- [ ] **Step 4: Create .env.example**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 5: Update .gitignore**

Add to the end of `.gitignore` (create it if it doesn't exist):

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Verify Vite starts (will fail gracefully since src/ doesn't exist yet)**

```bash
npm run dev
```

Expected: server starts on `http://localhost:5173`, serves the existing `index.html` (card finder works). Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js .env.example .gitignore
git commit -m "feat: initialize Vite project"
```

---

## Task 2: Extract Card Data to src/cards.js

**Files:**
- Create: `src/cards.js`
- Modify: `index.html` (remove `CARDS`, `BROWSE_CATS`, `TAG_META` — add cadence field to each benefit)

The `index.html` `<script>` block (lines 1668–2846) contains three data structures we need in `src/cards.js`:
- `const CARDS = [...]` — lines 1677–2620
- `const BROWSE_CATS = {...}` — lines 2621–2644
- `const TAG_META = {...}` — lines 2646–2652

The UI functions (`initBrowse`, `filterCards`, etc.) stay in index.html for now (moved in Task 3).

**Before extracting, add a `cadence` field to every benefit object inside each card's `credits` array.** Use these rules:

| Pattern in `name` or `desc` | Cadence |
|------------------------------|---------|
| `/mo`, `monthly`, `per month` | `'monthly'` |
| `semi-annually`, `twice a year` | `'semi-annual'` |
| `annual`, `per year`, `yearly`, `each year` | `'annual'` |
| Lounge access, hotel status, insurance, subscriptions billed once (Apple TV+), every N years | `'excluded'` |

Examples from the Chase Sapphire Reserve card:
```js
{ name: '$300 Annual Travel Credit', desc: 'Auto-applied...', value: 300, cadence: 'annual' },
{ name: '$500 The Edit Hotel Credit', desc: '$250 semi-annually...', value: 500, cadence: 'semi-annual' },
{ name: '$300 Annual Dining Credit', desc: '$150 semi-annually...', value: 300, cadence: 'semi-annual' },
{ name: '$300 Annual StubHub Credit', desc: '$150 semi-annually...', value: 300, cadence: 'semi-annual' },
{ name: '$420 DoorDash Value', desc: 'Up to $25/mo...', value: 420, cadence: 'monthly' },
{ name: '$250 Apple TV+ & Apple Music', desc: 'Complimentary subscriptions...', value: 250, cadence: 'excluded' },
{ name: '$120 Lyft Credit', desc: '$10/mo in Lyft...', value: 120, cadence: 'monthly' },
{ name: '$120 Peloton Membership Credit', desc: '$10/mo toward...', value: 120, cadence: 'monthly' },
{ name: 'Global Entry, TSA PreCheck or NEXUS', desc: 'Up to $120 credit every 4 years', value: 30, cadence: 'excluded' },
{ name: 'Chase Sapphire Lounge + Priority Pass', desc: 'Unlimited access...', value: 429, cadence: 'excluded' },
{ name: 'IHG Platinum Elite Status', desc: 'Complimentary through...', value: 0, cadence: 'excluded' },
```

- [ ] **Step 1: Create src/cards.js**

Open `index.html`. Cut lines 1677–2652 (from `const CARDS = [` through the closing `};` of `TAG_META`). Paste into a new file `src/cards.js` and add export keywords:

```js
// src/cards.js
// Card and benefit data — shared by card finder (main.js) and tracker (tracker.js).
// cadence values: 'monthly' | 'semi-annual' | 'annual' | 'excluded'

export const CARDS = [
  // ... (pasted from index.html, with cadence field added to every benefit)
];

export const BROWSE_CATS = {
  // ... (pasted from index.html)
};

export const TAG_META = {
  // ... (pasted from index.html)
};
```

- [ ] **Step 2: Write a test to verify cadence completeness**

Create `src/cards.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CARDS } from './cards.js';

const VALID_CADENCES = ['monthly', 'semi-annual', 'annual', 'excluded'];

describe('CARDS data integrity', () => {
  it('every card has an id, name, and issuer', () => {
    for (const card of CARDS) {
      expect(card.id, `card missing id`).toBeTruthy();
      expect(card.name, `${card.id} missing name`).toBeTruthy();
      expect(card.issuer, `${card.id} missing issuer`).toBeTruthy();
    }
  });

  it('every benefit has a valid cadence field', () => {
    for (const card of CARDS) {
      for (const benefit of card.credits) {
        expect(
          VALID_CADENCES,
          `${card.id} → "${benefit.name}" has invalid cadence: "${benefit.cadence}"`
        ).toContain(benefit.cadence);
      }
    }
  });

  it('every benefit has a name and numeric value', () => {
    for (const card of CARDS) {
      for (const benefit of card.credits) {
        expect(benefit.name, `${card.id} benefit missing name`).toBeTruthy();
        expect(typeof benefit.value, `${card.id} → "${benefit.name}" value must be number`).toBe('number');
      }
    }
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npm test
```

Expected: tests fail with errors pointing to any benefits missing cadence. Fix each one by adding the correct `cadence` field per the table above, then rerun until all pass.

- [ ] **Step 4: Commit**

```bash
git add src/cards.js src/cards.test.js
git commit -m "feat: extract card data to src/cards.js with cadence field"
```

---

## Task 3: Migrate index.html to src/main.js

**Files:**
- Create: `src/main.js`
- Modify: `index.html`

The remaining content in the `index.html` `<script>` block (after removing CARDS/BROWSE_CATS/TAG_META in Task 2) is the UI logic: `activeBrowseFilter`, and functions `initBrowse`, `filterCards`, `renderBrowseCards`, `openModal`, `closeModal`, `closeModalOutside`, plus the `DOMContentLoaded` listener.

- [ ] **Step 1: Create src/main.js**

Cut the remaining content of the `<script>` block from `index.html` (lines 1668–2846, now containing only UI functions after Task 2 removed the data). Paste into `src/main.js` and add the import at the top:

```js
import { CARDS, BROWSE_CATS, TAG_META } from './cards.js';

// (paste all remaining UI functions here — activeBrowseFilter, initBrowse,
//  filterCards, renderBrowseCards, openModal, closeModal, closeModalOutside,
//  and the DOMContentLoaded listener)
```

- [ ] **Step 2: Update index.html**

Remove the entire `<script>...</script>` block from `index.html` (now empty). Replace it with:

```html
<script type="module" src="/src/main.js"></script>
```

Place this line just before `</body>`.

- [ ] **Step 3: Verify card finder works**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- Cards render in the browse grid
- Filter buttons work
- Clicking a card opens the modal
- Modal closes on Escape and outside click

- [ ] **Step 4: Commit**

```bash
git add src/main.js index.html
git commit -m "feat: migrate index.html JS to src/main.js"
```

---

## Task 4: Period Key Logic (TDD)

**Files:**
- Create: `src/tracker-utils.js`
- Create: `src/tracker-utils.test.js`

These are pure functions with no DOM or network dependencies — ideal for TDD.

- [ ] **Step 1: Write the failing tests**

Create `src/tracker-utils.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  getCurrentPeriodKey,
  getPeriodEndDate,
  getDaysUntilPeriodEnd,
  isExpiringSoon,
} from './tracker-utils.js';

describe('getCurrentPeriodKey', () => {
  it('returns YYYY-MM for monthly cadence', () => {
    expect(getCurrentPeriodKey('monthly', new Date(2026, 3, 12))).toBe('2026-04');
  });

  it('zero-pads single-digit months', () => {
    expect(getCurrentPeriodKey('monthly', new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('returns YYYY-H1 for semi-annual in Jan–Jun', () => {
    expect(getCurrentPeriodKey('semi-annual', new Date(2026, 3, 12))).toBe('2026-H1');
  });

  it('returns YYYY-H2 for semi-annual in Jul–Dec', () => {
    expect(getCurrentPeriodKey('semi-annual', new Date(2026, 8, 1))).toBe('2026-H2');
  });

  it('returns current year for annual when today is after anniversary', () => {
    // Anniversary March 1, today April 12 → period started March 2026
    expect(getCurrentPeriodKey('annual', new Date(2026, 3, 12), 3, 1)).toBe('2026');
  });

  it('returns previous year for annual when today is before anniversary', () => {
    // Anniversary June 1, today April 12 → period started June 2025
    expect(getCurrentPeriodKey('annual', new Date(2026, 3, 12), 6, 1)).toBe('2025');
  });

  it('throws on unknown cadence', () => {
    expect(() => getCurrentPeriodKey('quarterly', new Date())).toThrow('Unknown cadence');
  });
});

describe('getPeriodEndDate', () => {
  it('returns last day of current month for monthly', () => {
    const end = getPeriodEndDate('monthly', new Date(2026, 3, 12)); // April
    expect(end.getMonth()).toBe(3); // April
    expect(end.getDate()).toBe(30);
  });

  it('returns June 30 for semi-annual H1', () => {
    const end = getPeriodEndDate('semi-annual', new Date(2026, 3, 12));
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
  });

  it('returns Dec 31 for semi-annual H2', () => {
    const end = getPeriodEndDate('semi-annual', new Date(2026, 8, 1));
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it('returns day before next anniversary for annual', () => {
    // Anniversary March 1, today April 12 → period ends Feb 28, 2027
    const end = getPeriodEndDate('annual', new Date(2026, 3, 12), 3, 1);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(1); // February
    expect(end.getDate()).toBe(28);
  });
});

describe('getDaysUntilPeriodEnd', () => {
  it('returns 5 when 5 days left in month', () => {
    // April has 30 days; April 25 → 5 days left
    expect(getDaysUntilPeriodEnd('monthly', new Date(2026, 3, 25))).toBe(5);
  });

  it('returns 1 on last day of month', () => {
    expect(getDaysUntilPeriodEnd('monthly', new Date(2026, 3, 30))).toBe(1);
  });
});

describe('isExpiringSoon', () => {
  it('returns true when 5 days left (within default 7-day threshold)', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 25))).toBe(true);
  });

  it('returns false when 15 days left', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 15))).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 25), 1, 1, 3)).toBe(false);
    expect(isExpiringSoon('monthly', new Date(2026, 3, 28), 1, 1, 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './tracker-utils.js'`

- [ ] **Step 3: Create src/tracker-utils.js**

```js
// src/tracker-utils.js

/**
 * Returns the period key string for a benefit based on its cadence.
 * @param {'monthly'|'semi-annual'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth  1–12 (only used for 'annual')
 * @param {number} anniversaryDay    1–28 (only used for 'annual')
 * @returns {string}  e.g. '2026-04', '2026-H1', '2026'
 */
export function getCurrentPeriodKey(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-based

  if (cadence === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  if (cadence === 'semi-annual') {
    return month <= 6 ? `${year}-H1` : `${year}-H2`;
  }

  if (cadence === 'annual') {
    // Period starts on anniversaryMonth/anniversaryDay each year.
    // If today is before this year's anniversary date, the current period
    // started in the previous year.
    const thisYearAnniversary = new Date(year, anniversaryMonth - 1, anniversaryDay);
    return today < thisYearAnniversary ? `${year - 1}` : `${year}`;
  }

  throw new Error(`Unknown cadence: ${cadence}`);
}

/**
 * Returns the last Date of the current period.
 * @param {'monthly'|'semi-annual'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth
 * @param {number} anniversaryDay
 * @returns {Date}
 */
export function getPeriodEndDate(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  if (cadence === 'monthly') {
    // Day 0 of the next month = last day of current month
    return new Date(year, month, 0);
  }

  if (cadence === 'semi-annual') {
    return month <= 6
      ? new Date(year, 5, 30)   // June 30
      : new Date(year, 11, 31); // Dec 31
  }

  if (cadence === 'annual') {
    const thisYearAnniversary = new Date(year, anniversaryMonth - 1, anniversaryDay);
    if (today < thisYearAnniversary) {
      // Period ends the day before this year's anniversary
      return new Date(year, anniversaryMonth - 1, anniversaryDay - 1);
    }
    // Period ends the day before next year's anniversary
    return new Date(year + 1, anniversaryMonth - 1, anniversaryDay - 1);
  }

  throw new Error(`Unknown cadence: ${cadence}`);
}

/**
 * Returns whole days remaining until the current period ends.
 * @param {'monthly'|'semi-annual'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth
 * @param {number} anniversaryDay
 * @returns {number}
 */
export function getDaysUntilPeriodEnd(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const endDate = getPeriodEndDate(cadence, today, anniversaryMonth, anniversaryDay);
  // Set end to end-of-day so "today = last day" returns 1, not 0
  endDate.setHours(23, 59, 59, 999);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((endDate - today) / msPerDay);
}

/**
 * Returns true if the current period ends within thresholdDays.
 * @param {'monthly'|'semi-annual'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth
 * @param {number} anniversaryDay
 * @param {number} thresholdDays  default 7
 * @returns {boolean}
 */
export function isExpiringSoon(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1, thresholdDays = 7) {
  return getDaysUntilPeriodEnd(cadence, today, anniversaryMonth, anniversaryDay) <= thresholdDays;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests in `tracker-utils.test.js` and `cards.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/tracker-utils.js src/tracker-utils.test.js
git commit -m "feat: add period key and expiry logic with tests"
```

---

## Task 5: Set Up Supabase

**Files:**
- Create: `src/supabase.js`
- No code changes — requires manual steps in Supabase dashboard

**Prerequisites:** Create a free Supabase project at supabase.com. Copy the Project URL and anon key from Project Settings → API.

- [ ] **Step 1: Create .env**

```bash
cp .env.example .env
```

Fill in real values:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

- [ ] **Step 2: Create src/supabase.js**

```js
// src/supabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

- [ ] **Step 3: Run the SQL migration in Supabase**

In the Supabase dashboard, open the SQL Editor and run:

```sql
-- user_cards: which cards are in the user's wallet
create table public.user_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  card_id          text not null,
  anniversary_day  integer not null check (anniversary_day between 1 and 28),
  anniversary_month integer not null check (anniversary_month between 1 and 12),
  added_at         timestamptz default now() not null,
  unique (user_id, card_id)
);

alter table public.user_cards enable row level security;

create policy "Users manage their own cards"
  on public.user_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- benefit_usage: which benefits have been used in a given period
create table public.benefit_usage (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  card_id      text not null,
  benefit_name text not null,
  period_key   text not null,
  used_at      timestamptz default now() not null,
  unique (user_id, card_id, benefit_name, period_key)
);

alter table public.benefit_usage enable row level security;

create policy "Users manage their own benefit usage"
  on public.benefit_usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 4: Enable email auth in Supabase**

In Supabase dashboard → Authentication → Providers → Email: confirm it is enabled. Under "Email" settings, enable "Magic Link".

- [ ] **Step 5: Commit**

```bash
git add src/supabase.js
git commit -m "feat: add Supabase client"
```

---

## Task 6: tracker.html + Auth Screen

**Files:**
- Create: `tracker.html`
- Create: `src/tracker.js` (auth portion)

- [ ] **Step 1: Create tracker.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Tracker — Point Taken</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --forest: #1e3a2f; --forest-mid: #2d5443; --forest-light: #3d6b54;
      --rust: #c0541a; --parchment: #f7f3ec; --parchment-2: #ede8df;
      --ink: #1a1a18; --muted: #7a7568; --white: #fdfcf9;
      --green-pale: #eaf2ec; --green-text: #1e5c32;
      --red-pale: #faecea; --red-text: #9b2a1a;
      --border: rgba(30,58,47,0.12);
      --shadow: 0 4px 24px rgba(30,58,47,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Lato', sans-serif; background: var(--parchment); color: var(--ink); min-height: 100vh; font-size: 15px; line-height: 1.6; }

    /* ── Layout ── */
    #app { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }

    /* ── Auth ── */
    .auth-container { max-width: 400px; margin: 80px auto 0; }
    .auth-title { font-family: 'Instrument Serif', serif; font-size: 2rem; color: var(--forest); margin-bottom: 6px; }
    .auth-sub { color: var(--muted); margin-bottom: 28px; }
    .auth-card { background: var(--white); border: 1.5px solid var(--border); border-radius: 8px; padding: 28px; box-shadow: var(--shadow); }
    .auth-tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 1.5px solid var(--border); }
    .auth-tab { background: none; border: none; padding: 8px 16px; font-size: 0.9rem; font-weight: 700; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1.5px; }
    .auth-tab.active { color: var(--forest); border-bottom-color: var(--forest); }
    .auth-input { display: block; width: 100%; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 4px; font-size: 0.95rem; margin-bottom: 12px; background: var(--parchment); }
    .auth-input:focus { outline: none; border-color: var(--forest); }
    .auth-submit { width: 100%; padding: 11px; background: var(--forest); color: var(--white); border: none; border-radius: 4px; font-size: 0.95rem; font-weight: 700; cursor: pointer; }
    .auth-submit:hover { background: var(--forest-mid); }
    .auth-divider { text-align: center; color: var(--muted); font-size: 0.8rem; margin: 14px 0; }
    .auth-magic { width: 100%; padding: 10px; background: transparent; border: 1.5px solid var(--border); border-radius: 4px; font-size: 0.9rem; cursor: pointer; color: var(--forest); }
    .auth-magic:hover { background: var(--parchment-2); }
    .auth-message { margin-top: 12px; font-size: 0.85rem; min-height: 20px; }

    /* ── Wallet ── */
    .wallet-header { margin-bottom: 24px; }
    .wallet-header h1 { font-family: 'Instrument Serif', serif; font-size: 1.8rem; color: var(--forest); }
    .wallet-sub { color: var(--muted); margin-top: 4px; }
    .wallet-card { border: 1.5px solid var(--border); border-radius: 6px; padding: 14px 16px; margin-bottom: 10px; background: var(--white); }
    .wallet-card.owned { border-color: var(--forest-light); background: var(--green-pale); }
    .wallet-card-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .wallet-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--forest); }
    .wallet-card-name { font-weight: 700; flex: 1; }
    .wallet-card-issuer { color: var(--muted); font-size: 0.85rem; }
    .wallet-anniversary { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .anniv-label { font-size: 0.85rem; color: var(--muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .anniv-select { padding: 4px 8px; border: 1.5px solid var(--border); border-radius: 4px; font-size: 0.85rem; background: var(--parchment); }
    .anniv-day-input { width: 56px; padding: 4px 8px; border: 1.5px solid var(--border); border-radius: 4px; font-size: 0.85rem; background: var(--parchment); }
    .wallet-save { margin-top: 20px; padding: 11px 28px; background: var(--forest); color: var(--white); border: none; border-radius: 4px; font-size: 0.95rem; font-weight: 700; cursor: pointer; }
    .wallet-save:hover { background: var(--forest-mid); }

    /* ── Dashboard ── */
    .dashboard-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
    .dashboard-header h1 { font-family: 'Instrument Serif', serif; font-size: 1.8rem; color: var(--forest); }
    .dashboard-actions { display: flex; gap: 10px; }
    .btn-secondary { padding: 7px 14px; background: transparent; border: 1.5px solid var(--forest); border-radius: 4px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; color: var(--forest); text-decoration: none; }
    .btn-secondary:hover { background: var(--forest); color: var(--white); }

    /* ── Use It or Lose It ── */
    .expiring-panel { background: #fff8ed; border: 1.5px solid #e8a730; border-radius: 8px; padding: 18px 20px; margin-bottom: 28px; }
    .expiring-title { font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7a5200; margin-bottom: 12px; }
    .expiring-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(232,167,48,0.2); }
    .expiring-row:last-child { border-bottom: none; }
    .expiring-card { font-size: 0.8rem; color: var(--muted); min-width: 140px; }
    .expiring-benefit { flex: 1; font-size: 0.9rem; font-weight: 700; }
    .expiring-days { font-size: 0.8rem; font-weight: 700; color: #c07000; white-space: nowrap; }

    /* ── Card sections ── */
    .card-section { border: 1.5px solid var(--border); border-radius: 8px; margin-bottom: 16px; background: var(--white); overflow: hidden; }
    .card-section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--parchment-2); border-bottom: 1px solid var(--border); }
    .card-section-name { font-weight: 700; font-size: 1rem; }
    .card-section-progress { font-size: 0.82rem; color: var(--muted); }
    .benefit-row { display: flex; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid var(--border); }
    .benefit-row:last-child { border-bottom: none; }
    .benefit-row.used { opacity: 0.45; }
    .benefit-label { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
    .benefit-label input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--forest); cursor: pointer; }
    .benefit-name { font-size: 0.92rem; }
    .benefit-cadence { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 3px; white-space: nowrap; }
    .cadence-monthly    { background: #e8f0fe; color: #1a56a0; }
    .cadence-semi-annual { background: #e8f0fe; color: #1a56a0; }
    .cadence-annual     { background: var(--green-pale); color: var(--green-text); }
    .benefit-value { font-size: 0.85rem; font-weight: 700; color: var(--forest); white-space: nowrap; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/tracker.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/tracker.js with auth screen**

```js
// src/tracker.js
import { supabase } from './supabase.js';
import { CARDS } from './cards.js';
import { getCurrentPeriodKey, isExpiringSoon, getDaysUntilPeriodEnd } from './tracker-utils.js';

// ── State ──────────────────────────────────────────────────────────────────────
let session = null;
let userCards = [];        // rows from user_cards
let usedBenefits = new Set(); // keys: `${cardId}__${benefitName}__${periodKey}`

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session: s } } = await supabase.auth.getSession();
  session = s;
  await render();

  supabase.auth.onAuthStateChange(async (_event, s) => {
    session = s;
    await render();
  });
});

// ── Router ────────────────────────────────────────────────────────────────────
async function render() {
  const app = document.getElementById('app');
  if (!session) { renderAuth(app); return; }
  await loadData();
  const showWallet = new URLSearchParams(window.location.search).has('wallet')
    || userCards.length === 0;
  if (showWallet) { renderWallet(app); return; }
  renderDashboard(app);
}

// ── Data ──────────────────────────────────────────────────────────────────────
async function loadData() {
  const uid = session.user.id;
  const { data: cards } = await supabase.from('user_cards').select('*').eq('user_id', uid);
  userCards = cards || [];

  const today = new Date();
  const periodKeys = new Set();
  for (const uc of userCards) {
    const card = CARDS.find(c => c.id === uc.card_id);
    if (!card) continue;
    for (const b of card.credits) {
      if (b.cadence === 'excluded') continue;
      periodKeys.add(getCurrentPeriodKey(b.cadence, today, uc.anniversary_month, uc.anniversary_day));
    }
  }

  if (periodKeys.size === 0) { usedBenefits = new Set(); return; }

  const { data: usage } = await supabase
    .from('benefit_usage').select('*')
    .eq('user_id', uid)
    .in('period_key', [...periodKeys]);
  usedBenefits = new Set((usage || []).map(u => `${u.card_id}__${u.benefit_name}__${u.period_key}`));
}

async function toggleBenefit(cardId, benefitName, cadence, anniversaryMonth, anniversaryDay) {
  const today = new Date();
  const periodKey = getCurrentPeriodKey(cadence, today, anniversaryMonth, anniversaryDay);
  const key = `${cardId}__${benefitName}__${periodKey}`;
  const uid = session.user.id;

  if (usedBenefits.has(key)) {
    await supabase.from('benefit_usage').delete()
      .eq('user_id', uid).eq('card_id', cardId)
      .eq('benefit_name', benefitName).eq('period_key', periodKey);
    usedBenefits.delete(key);
  } else {
    await supabase.from('benefit_usage').insert(
      { user_id: uid, card_id: cardId, benefit_name: benefitName, period_key: periodKey }
    );
    usedBenefits.add(key);
  }
  renderDashboard(document.getElementById('app'));
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function renderAuth(app) {
  app.innerHTML = `
    <div class="auth-container">
      <h1 class="auth-title">My Tracker</h1>
      <p class="auth-sub">Track which card benefits you've used this month.</p>
      <div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login" onclick="authSwitchTab('login')">Log in</button>
          <button class="auth-tab" id="tab-signup" onclick="authSwitchTab('signup')">Sign up</button>
        </div>
        <form id="auth-form" data-mode="login" onsubmit="authSubmit(event)">
          <input class="auth-input" id="auth-email" type="email" placeholder="Email" required>
          <input class="auth-input" id="auth-password" type="password" placeholder="Password" required minlength="6">
          <button class="auth-submit" type="submit" id="auth-submit-btn">Log in</button>
        </form>
        <div class="auth-divider">or</div>
        <button class="auth-magic" onclick="authMagicLink()">Email me a login link</button>
        <p class="auth-message" id="auth-message"></p>
      </div>
    </div>
  `;

  window.authSwitchTab = (tab) => {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
    document.getElementById('auth-submit-btn').textContent = tab === 'login' ? 'Log in' : 'Sign up';
    document.getElementById('auth-form').dataset.mode = tab;
  };

  window.authSubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const mode = e.target.dataset.mode;
    const msg = document.getElementById('auth-message');
    const { error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      msg.textContent = error.message;
      msg.style.color = 'var(--red-text)';
    } else if (mode === 'signup') {
      msg.textContent = 'Check your email to confirm your account.';
      msg.style.color = 'var(--green-text)';
    }
  };

  window.authMagicLink = async () => {
    const email = document.getElementById('auth-email').value;
    const msg = document.getElementById('auth-message');
    if (!email) { msg.textContent = 'Enter your email first.'; return; }
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { msg.textContent = error.message; msg.style.color = 'var(--red-text)'; return; }
    msg.textContent = 'Magic link sent — check your email.';
    msg.style.color = 'var(--green-text)';
  };
}
```

- [ ] **Step 3: Verify auth screen renders**

```bash
npm run dev
```

Open `http://localhost:5173/tracker.html`. Expected: auth screen with "Log in" / "Sign up" tabs and magic link button.

- [ ] **Step 4: Commit**

```bash
git add tracker.html src/tracker.js
git commit -m "feat: add tracker.html and auth screen"
```

---

## Task 7: Wallet Management

**Files:**
- Modify: `src/tracker.js` (add `renderWallet` function)

- [ ] **Step 1: Add renderWallet to src/tracker.js**

Add after the closing brace of `renderAuth`:

```js
// ── Wallet ────────────────────────────────────────────────────────────────────
function renderWallet(app) {
  const ownedIds = new Set(userCards.map(uc => uc.card_id));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getAnnivMonth = (cardId) => userCards.find(c => c.card_id === cardId)?.anniversary_month ?? 1;
  const getAnnivDay   = (cardId) => userCards.find(c => c.card_id === cardId)?.anniversary_day   ?? 1;

  const cardsHtml = CARDS.map(card => `
    <div class="wallet-card ${ownedIds.has(card.id) ? 'owned' : ''}" id="wc-${card.id}">
      <label class="wallet-card-label">
        <input type="checkbox" class="wallet-checkbox" data-card-id="${card.id}"
          ${ownedIds.has(card.id) ? 'checked' : ''}
          onchange="walletToggleCard(this)">
        <span class="wallet-card-name">${card.name}</span>
        <span class="wallet-card-issuer">${card.issuer}</span>
      </label>
      <div class="wallet-anniversary" id="wa-${card.id}"
           style="display:${ownedIds.has(card.id) ? 'block' : 'none'}">
        <label class="anniv-label">Card anniversary:
          <select class="anniv-select" id="am-${card.id}">
            ${months.map((m, i) => `<option value="${i+1}" ${getAnnivMonth(card.id) === i+1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          Day:
          <input type="number" class="anniv-day-input" id="ad-${card.id}"
            min="1" max="28" value="${getAnnivDay(card.id)}">
        </label>
      </div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="wallet-header">
      <h1>My Wallet</h1>
      <p class="wallet-sub">Select the cards you own and enter the month you opened each one.</p>
    </div>
    <div>${cardsHtml}</div>
    <button class="wallet-save" onclick="walletSave()">Save Wallet</button>
  `;

  window.walletToggleCard = (checkbox) => {
    const id = checkbox.dataset.cardId;
    document.getElementById(`wa-${id}`).style.display = checkbox.checked ? 'block' : 'none';
    document.getElementById(`wc-${id}`).classList.toggle('owned', checkbox.checked);
  };

  window.walletSave = async () => {
    const uid = session.user.id;
    const checked = [...document.querySelectorAll('.wallet-checkbox:checked')];
    await supabase.from('user_cards').delete().eq('user_id', uid);
    if (checked.length > 0) {
      const rows = checked.map(cb => {
        const id = cb.dataset.cardId;
        return {
          user_id: uid, card_id: id,
          anniversary_month: parseInt(document.getElementById(`am-${id}`).value),
          anniversary_day:   Math.min(28, Math.max(1, parseInt(document.getElementById(`ad-${id}`).value) || 1)),
        };
      });
      await supabase.from('user_cards').insert(rows);
    }
    window.location.href = '/tracker.html';
  };
}
```

- [ ] **Step 2: Test wallet manually**

Sign up/in at `http://localhost:5173/tracker.html`. Expected: wallet screen appears (empty wallet). Select two cards, set anniversary dates, click Save. Expected: redirects to `/tracker.html` and shows dashboard (or wallet again if save failed — check browser console for Supabase errors).

- [ ] **Step 3: Commit**

```bash
git add src/tracker.js
git commit -m "feat: add wallet management UI"
```

---

## Task 8: Benefit Dashboard + Use It or Lose It Panel

**Files:**
- Modify: `src/tracker.js` (add `renderDashboard` function)

- [ ] **Step 1: Add renderDashboard to src/tracker.js**

Add after the closing brace of `renderWallet`:

```js
// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(app) {
  const today = new Date();

  // ── Build "Use It or Lose It" list ──
  const expiring = [];
  for (const uc of userCards) {
    const card = CARDS.find(c => c.id === uc.card_id);
    if (!card) continue;
    for (const b of card.credits) {
      if (b.cadence === 'excluded') continue;
      const periodKey = getCurrentPeriodKey(b.cadence, today, uc.anniversary_month, uc.anniversary_day);
      const key = `${uc.card_id}__${b.name}__${periodKey}`;
      if (!usedBenefits.has(key) && isExpiringSoon(b.cadence, today, uc.anniversary_month, uc.anniversary_day)) {
        expiring.push({
          card, benefit: b, uc,
          daysLeft: getDaysUntilPeriodEnd(b.cadence, today, uc.anniversary_month, uc.anniversary_day),
        });
      }
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  const expiringHtml = expiring.length === 0 ? '' : `
    <div class="expiring-panel">
      <div class="expiring-title">Use It or Lose It</div>
      ${expiring.map(e => `
        <div class="expiring-row">
          <span class="expiring-card">${e.card.name}</span>
          <span class="expiring-benefit">${e.benefit.name}</span>
          <span class="expiring-days">${e.daysLeft}d left</span>
        </div>
      `).join('')}
    </div>
  `;

  // ── Build per-card sections ──
  const cardsHtml = userCards.map(uc => {
    const card = CARDS.find(c => c.id === uc.card_id);
    if (!card) return '';
    const trackable = card.credits.filter(b => b.cadence !== 'excluded');
    if (trackable.length === 0) return '';

    let usedValue = 0;
    let totalValue = 0;
    const rowsHtml = trackable.map(b => {
      const periodKey = getCurrentPeriodKey(b.cadence, today, uc.anniversary_month, uc.anniversary_day);
      const key = `${uc.card_id}__${b.name}__${periodKey}`;
      const used = usedBenefits.has(key);
      totalValue += b.value;
      if (used) usedValue += b.value;
      return `
        <div class="benefit-row ${used ? 'used' : ''}">
          <label class="benefit-label">
            <input type="checkbox" ${used ? 'checked' : ''}
              onchange="dashToggle(${JSON.stringify(uc.card_id)}, ${JSON.stringify(b.name)}, '${b.cadence}', ${uc.anniversary_month}, ${uc.anniversary_day})">
            <span class="benefit-name">${b.name}</span>
          </label>
          <span class="benefit-cadence cadence-${b.cadence}">${b.cadence}</span>
          <span class="benefit-value">$${b.value}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="card-section">
        <div class="card-section-header">
          <span class="card-section-name">${card.name}</span>
          <span class="card-section-progress">$${usedValue} of $${totalValue} used</span>
        </div>
        <div>${rowsHtml}</div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="dashboard-header">
      <h1>My Benefits</h1>
      <div class="dashboard-actions">
        <a href="?wallet" class="btn-secondary">Edit Wallet</a>
        <button class="btn-secondary" onclick="dashSignOut()">Sign out</button>
      </div>
    </div>
    ${expiringHtml}
    ${cardsHtml}
  `;

  window.dashToggle = (cardId, benefitName, cadence, anniversaryMonth, anniversaryDay) => {
    toggleBenefit(cardId, benefitName, cadence, anniversaryMonth, anniversaryDay);
  };

  window.dashSignOut = async () => {
    await supabase.auth.signOut();
  };
}
```

- [ ] **Step 2: Test dashboard manually**

With cards already in your wallet from Task 7, log in and verify:
- Each card shows a section with benefit rows
- Checking a benefit dims the row and updates the `$X of $Y used` counter
- Unchecking restores the row
- "Edit Wallet" navigates to `?wallet` and shows the wallet screen with current cards pre-checked
- "Sign out" returns to auth screen

- [ ] **Step 3: Test "Use It or Lose It" panel**

In the browser console on `http://localhost:5173/tracker.html`, temporarily override `Date` to simulate end-of-month:

```js
// Paste in browser console to simulate April 28
const OrigDate = Date;
Date = class extends OrigDate { constructor(...a) { super(...a); } };
Date.now = () => new OrigDate(2026, 3, 28).getTime();
```

Refresh the page. Expected: any unused monthly benefits appear in the yellow panel with day counts.

- [ ] **Step 4: Commit**

```bash
git add src/tracker.js
git commit -m "feat: add benefit dashboard and use-it-or-lose-it panel"
```

---

## Task 9: Add Nav Link to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Find the existing nav/header area in index.html**

Search for the site header or top navigation. Look for the element containing the "Point Taken" logo or top-level nav links.

Run:
```bash
grep -n "site-header\|nav\|Point Taken\|logo" index.html | head -20
```

- [ ] **Step 2: Add "My Tracker" link**

In the header element (wherever the site title/nav is), add:

```html
<a href="/tracker.html" style="
  font-family: 'Lato', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--forest);
  text-decoration: none;
  border-bottom: 1px solid var(--forest-light);
  padding-bottom: 1px;
">My Tracker</a>
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify the link appears in the header and navigates to the tracker page.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add My Tracker nav link to header"
```

---

## Task 10: GitHub Actions Deploy Workflow

**Files:**
- Create/Replace: `.github/workflows/deploy.yml`

**Prerequisites:** In the GitHub repo → Settings → Secrets and variables → Actions, add two repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Also in GitHub repo → Settings → Pages, set Source to "GitHub Actions".

- [ ] **Step 1: Create .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - uses: actions/configure-pages@v4

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify build succeeds locally**

```bash
npm run build
```

Expected: `dist/` created, no errors. Contents should include `dist/index.html`, `dist/tracker.html`, and hashed JS/CSS assets.

- [ ] **Step 3: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow for Vite build"
git push
```

Expected: GitHub Actions workflow triggers. Go to the repo's Actions tab and confirm the workflow succeeds and deploys to `https://milesfrombrooklyn.github.io/PointTaken/tracker.html`.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Vite migration | Tasks 1, 3 |
| src/cards.js with cadence field | Task 2 |
| Supabase auth (email + magic link) | Tasks 5, 6 |
| user_cards table + RLS | Task 5 |
| benefit_usage table + RLS | Task 5 |
| My Wallet UI (select cards, set anniversary) | Task 7 |
| Benefit Dashboard with checkboxes | Task 8 |
| Period key auto-reset logic | Task 4 |
| Use It or Lose It panel | Task 8 |
| Nav link from index.html | Task 9 |
| GitHub Actions deploy | Task 10 |

All spec requirements covered. ✅
