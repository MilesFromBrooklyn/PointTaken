# Guest Preview Mode — Design Spec

**Date:** 2026-04-12
**Feature:** Allow unauthenticated visitors to browse the tracker dashboard as a read-only preview before signing up.

---

## Overview

When no Supabase session exists, the tracker renders the full dashboard with 3 pre-selected demo cards and all benefits unchecked. A banner at the top of the page identifies the experience as a preview and provides a "Sign In" path. Clicking any benefit checkbox shows an inline prompt inviting the user to sign in. No data is written to Supabase during guest preview.

---

## Architecture

All changes are confined to `src/tracker.js` and `tracker.html` (CSS only). No new files are created.

### State change

Add a boolean `guestMode` flag to tracker state:

```js
let guestMode = false;
```

### Router change

The `render()` function currently gates on `session`:

```
if (!session) → renderAuth()
```

Change to:

```
if (!session && !guestMode) → renderAuth()
if (!session &&  guestMode) → renderDashboard() with demo data
```

The "Sign In →" link in the banner sets `guestMode = false` and calls `render()`, swapping back to the auth form.

### Demo data

Three hard-coded card IDs used as the guest preview wallet. Card objects are pulled from the existing `CARDS` array in `src/cards.js` — no separate data file needed.

**Demo cards:**
- `chase-sapphire-preferred` — popular travel card with monthly/annual benefits
- `amex-gold-card` — popular dining card with monthly credits
- `capital-one-venture-x` — premium card with annual credits

`userCards` for guest mode is a synthetic array of three objects matching the `user_cards` schema, with `anniversary_month: 1` and `anniversary_day: 1` as defaults.

`usedBenefits` remains an empty Set for guest mode (all benefits unchecked).

---

## UI

### Banner

Rendered at the top of `#app` before the card sections. Styled using existing CSS variables.

```
👀 Preview mode — Sign in to track your own cards and save your progress.  [Sign In →]
```

- Background: `#fff8ed` (same amber tone as the Use It or Lose It panel)
- Border: `1.5px solid #e8a730`
- "Sign In →" is a button that sets `guestMode = false` and calls `render()`

### Checkbox behavior

When a guest clicks a benefit checkbox:
1. The checkbox snaps back to unchecked immediately
2. An inline message appears below that row: `"Sign in to save your progress →"`
3. The message is styled using the existing `.auth-message` pattern (small, muted, `var(--green-text)`)
4. The message disappears after 4 seconds or when another row is clicked

### No Use It or Lose It panel

The expiring-soon panel is suppressed in guest mode — since no benefits are marked used and the anniversary defaults are generic, the panel would be meaningless noise.

---

## Entry Point

The "My Tracker" nav link on `index.html` already points to `tracker.html`. No change needed. Guest preview is the default unauthenticated experience — no separate URL or query param required.

---

## What Does Not Change

- Auth form (login/signup/magic link) — identical
- Wallet view — identical
- Dashboard for authenticated users — identical
- Supabase schema, RLS, or any backend config — no changes

---

## Testing

Manual verification steps:
1. Visit `tracker.html` in an incognito window — should see dashboard with 3 demo cards and banner
2. Click a benefit checkbox — checkbox stays unchecked, inline message appears, fades after 4s
3. Click "Sign In →" in banner — auth form appears
4. Sign in — dashboard loads with user's real cards, no banner

No new unit tests needed (no new pure functions).
