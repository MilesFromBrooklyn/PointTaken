# Guest Preview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show unauthenticated visitors the full benefit dashboard with 3 demo cards, an amber "Preview mode" banner, and a prompt to sign in when they click a checkbox.

**Architecture:** Add a `guestMode` flag (default `true`) to `src/tracker.js`. When `!session && guestMode`, populate state from a hardcoded demo list and render the dashboard. The banner's "Sign In →" button sets `guestMode = false` and re-renders to the auth form. No new files; all changes are in `src/tracker.js` and `tracker.html` (CSS only).

**Tech Stack:** Vanilla JS, Vite 6 — no new dependencies.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/tracker.js` | Modify | Add guestMode flag, loadGuestData(), update render() and renderDashboard() |
| `tracker.html` | Modify | Add CSS for .guest-banner, .guest-nudge, and flex-wrap on .benefit-row |

---

## Task 1: Guest state, demo data loader, and router update

**Files:**
- Modify: `src/tracker.js`

- [ ] **Step 1: Add `guestMode` flag to state block**

In `src/tracker.js`, replace the state block (lines 6–9):

```js
// ── State ──────────────────────────────────────────────────────────────────────
let session = null;
let userCards = [];
let usedBenefits = new Set();
let guestMode = true; // show demo dashboard by default when unauthenticated
```

- [ ] **Step 2: Add `loadGuestData()` after the `loadData()` function**

After the closing `}` of `loadData()` (around line 58), insert:

```js
function loadGuestData() {
  userCards = [
    { card_id: 'csp',       anniversary_month: 1, anniversary_day: 1 },
    { card_id: 'amex-gold', anniversary_month: 1, anniversary_day: 1 },
    { card_id: 'venture-x', anniversary_month: 1, anniversary_day: 1 },
  ];
  usedBenefits = new Set();
}
```

- [ ] **Step 3: Update `render()` to route guest traffic**

Replace the existing `render()` function:

```js
async function render() {
  const app = document.getElementById('app');
  if (!session && !guestMode) { renderAuth(app); return; }
  if (!session && guestMode)  { loadGuestData(); renderDashboard(app); return; }
  await loadData();
  const showWallet = new URLSearchParams(window.location.search).has('wallet')
    || userCards.length === 0;
  if (showWallet) { renderWallet(app); return; }
  renderDashboard(app);
}
```

- [ ] **Step 4: Verify no runtime errors**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/tracker.js
git commit -m "feat: add guest mode state and demo data loader"
```

---

## Task 2: Update renderDashboard for guest UI + add CSS

**Files:**
- Modify: `src/tracker.js`
- Modify: `tracker.html`

- [ ] **Step 1: Replace `renderDashboard()` with the guest-aware version**

Replace the entire `renderDashboard` function in `src/tracker.js` with:

```js
// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(app) {
  const today = new Date();

  // Use It or Lose It — suppressed in guest mode (no real usage data)
  const expiringHtml = guestMode ? '' : (() => {
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
    return expiring.length === 0 ? '' : `
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
  })();

  const cardsHtml = userCards.map(uc => {
    const card = CARDS.find(c => c.id === uc.card_id);
    if (!card) return '';
    const trackable = card.credits.filter(b => b.cadence !== 'excluded');
    if (trackable.length === 0) return '';

    let usedValue = 0;
    let totalValue = 0;
    const rowsHtml = trackable.map((b, i) => {
      const periodKey = getCurrentPeriodKey(b.cadence, today, uc.anniversary_month, uc.anniversary_day);
      const key = `${uc.card_id}__${b.name}__${periodKey}`;
      const used = usedBenefits.has(key);
      totalValue += b.value;
      if (used) usedValue += b.value;
      const rowId = `br-${uc.card_id}-${i}`;
      const onchange = guestMode
        ? `dashGuestClick(this, '${rowId}')`
        : `dashToggle(${JSON.stringify(uc.card_id)}, ${JSON.stringify(b.name)}, '${b.cadence}', ${uc.anniversary_month}, ${uc.anniversary_day})`;
      return `
        <div class="benefit-row ${used ? 'used' : ''}" id="${rowId}">
          <label class="benefit-label">
            <input type="checkbox" ${used ? 'checked' : ''} onchange="${onchange}">
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

  const bannerHtml = guestMode ? `
    <div class="guest-banner">
      <span class="guest-banner-text">👀 Preview mode — Sign in to track your own cards and save your progress.</span>
      <button class="guest-banner-btn" onclick="guestSignIn()">Sign In →</button>
    </div>
  ` : '';

  const headerActionsHtml = guestMode
    ? `<button class="btn-secondary" onclick="guestSignIn()">Sign In</button>`
    : `<a href="?wallet" class="btn-secondary">Edit Wallet</a>
       <button class="btn-secondary" onclick="dashSignOut()">Sign out</button>`;

  app.innerHTML = `
    <div class="dashboard-header">
      <h1>My Benefits</h1>
      <div class="dashboard-actions">${headerActionsHtml}</div>
    </div>
    ${bannerHtml}
    ${expiringHtml}
    ${cardsHtml}
  `;

  window.dashToggle = (cardId, benefitName, cadence, anniversaryMonth, anniversaryDay) => {
    toggleBenefit(cardId, benefitName, cadence, anniversaryMonth, anniversaryDay);
  };

  window.dashSignOut = async () => {
    await supabase.auth.signOut();
  };

  window.guestSignIn = () => {
    guestMode = false;
    render();
  };

  window.dashGuestClick = (checkbox, rowId) => {
    checkbox.checked = false; // snap back
    const row = document.getElementById(rowId);
    const existing = row.querySelector('.guest-nudge');
    if (existing) { clearTimeout(existing._timer); existing.remove(); }
    const nudge = document.createElement('p');
    nudge.className = 'guest-nudge';
    nudge.innerHTML = '<a href="#" onclick="guestSignIn(); return false;">Sign in to save your progress →</a>';
    nudge._timer = setTimeout(() => nudge.remove(), 4000);
    row.appendChild(nudge);
  };
}
```

- [ ] **Step 2: Add CSS to `tracker.html`**

In `tracker.html`, inside the `<style>` block, add these rules before the closing `</style>` tag:

```css
/* ── Guest preview ── */
.guest-banner { background: #fff8ed; border: 1.5px solid #e8a730; border-radius: 8px; padding: 12px 18px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.guest-banner-text { flex: 1; color: #7a5200; font-size: 0.9rem; }
.guest-banner-btn { padding: 6px 14px; background: var(--forest); color: var(--white); border: none; border-radius: 4px; font-size: 0.85rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
.guest-banner-btn:hover { background: var(--forest-mid); }
.benefit-row { flex-wrap: wrap; }
.guest-nudge { flex-basis: 100%; font-size: 0.8rem; margin-top: 4px; padding-left: 25px; }
.guest-nudge a { color: var(--green-text); text-decoration: underline; }
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built` with no errors.

- [ ] **Step 4: Commit and push**

```bash
git add src/tracker.js tracker.html
git commit -m "feat: guest preview dashboard with sign-in nudge"
git push origin main
```

Expected: GitHub Actions deploy triggers. After ~1 minute, visit `https://milesfrombrooklyn.github.io/PointTaken/tracker.html` in an incognito window to confirm the preview dashboard appears without logging in.

---

## Manual Verification Checklist

After deploy:
- [ ] Incognito window → `tracker.html` shows 3 cards (Chase Sapphire Preferred, Amex Gold, Capital One Venture X) with amber banner
- [ ] Clicking a checkbox snaps back unchecked; "Sign in to save your progress →" appears and fades after 4 seconds
- [ ] Clicking "Sign In →" in banner or header shows the auth form
- [ ] After signing in, real user dashboard loads with no banner
