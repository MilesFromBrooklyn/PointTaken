// src/tracker.js
import { supabase } from './supabase.js';
import { CARDS } from './cards.js';
import { getCurrentPeriodKey, isExpiringSoon, getDaysUntilPeriodEnd } from './tracker-utils.js';

// ── State ──────────────────────────────────────────────────────────────────────
let session = null;
let userCards = [];
let usedBenefits = new Set();

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://milesfrombrooklyn.github.io/PointTaken/tracker.html' },
    });
    if (error) { msg.textContent = error.message; msg.style.color = 'var(--red-text)'; return; }
    msg.textContent = 'Magic link sent — check your email.';
    msg.style.color = 'var(--green-text)';
  };
}

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
          anniversary_day: Math.min(28, Math.max(1, parseInt(document.getElementById(`ad-${id}`).value) || 1)),
        };
      });
      await supabase.from('user_cards').insert(rows);
    }
    window.location.href = window.location.pathname;
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(app) {
  const today = new Date();

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
