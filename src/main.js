import { CARDS, BROWSE_CATS, TAG_META } from './cards.js';

// CARD DATA moved to src/cards.js

const CATS = [
  { id:'groceries',  label:'Groceries',                      ph:'400' },
  { id:'dining',     label:'Dining & Restaurants',            ph:'300' },
  { id:'flights',    label:'Flights (booked directly/Amex)',  ph:'150' },
  { id:'hotels',     label:'Hotels (booked directly)',        ph:'150' },
  { id:'gas',        label:'Gas',                            ph:'100' },
  { id:'streaming',  label:'Streaming Services',              ph:'30'  },
  { id:'shopping',   label:'Online Shopping',                 ph:'150' },
  { id:'everything', label:'Everything Else',                 ph:'500' },
];

const QS = [
  {
    id:'goal', icon:'🎯',
    text:'What\'s your main goal with a card?',
    hint:'Pick the one that matters most right now.',
    opts:[
      {v:'travel',   e:'✈️', l:'Free travel & flights',  d:'Earn points to fly and stay for less'},
      {v:'cashback', e:'💵', l:'Cash back in my pocket', d:'Get real money back on everyday spending'},
      {v:'both',     e:'🌟', l:'Flexible rewards',       d:'Travel sometimes, cash back other times'},
    ], twoCol:false
  },
  {
    id:'spend', icon:'🛒',
    text:'Where do you spend the most?',
    hint:'Think about a typical month — be honest.',
    opts:[
      {v:'groceries', e:'🥦', l:'Groceries & gas',   d:'Supermarkets, gas stations, daily errands'},
      {v:'dining',    e:'🍽️', l:'Dining & delivery', d:'Restaurants, Uber Eats, coffee runs'},
      {v:'travel',    e:'🏨', l:'Hotels & flights',  d:'Frequent traveler or work trips'},
      {v:'everything',e:'🛍️', l:'A bit of everything',d:'No single category dominates'},
    ], twoCol:true
  },
  {
    id:'fee', icon:'💳',
    text:'How do you feel about annual fees?',
    hint:'Higher-fee cards usually win — but only if you actually use the credits.',
    opts:[
      {v:'none', e:'🚫', l:'No fee, full stop',      d:'Keep it simple and free'},
      {v:'low',  e:'💰', l:'Up to $100 is fine',     d:'Worth it if the rewards deliver'},
      {v:'high', e:'👑', l:'Fine with $300–$700',    d:'I\'ll use the credits to offset it'},
    ], twoCol:false
  },
  {
    id:'credit', icon:'🏦',
    text:'What\'s your credit score range?',
    hint:'Helps me show cards you\'ll actually get approved for. Check Credit Karma for free.',
    opts:[
      {v:'fair',      e:'📊', l:'Fair (580–669)',   d:'Working on building it up'},
      {v:'good',      e:'✅', l:'Good (670–739)',   d:'Solid, reliable history'},
      {v:'excellent', e:'⭐', l:'Excellent (740+)', d:'Access to the best cards'},
    ], twoCol:false
  },
  {
    id:'travel', icon:'🗺️',
    text:'How often do you travel?',
    hint:'Helps me gauge whether lounge access and travel credits are actually worth it for you.',
    opts:[
      {v:'never',     e:'🏠', l:'Rarely or never',    d:'A trip or two a year, maybe'},
      {v:'sometimes', e:'🧳', l:'A few times a year', d:'3–6 trips, mostly domestic'},
      {v:'often',     e:'🌍', l:'Frequently',          d:'6+ trips per year, often international'},
    ], twoCol:false
  }
];

// ═══ AIRLINE QUESTION (shown conditionally as Q6) ═══
const AIRLINE_Q = {
  id:'airline', icon:'✈️',
  text:'Do you have a preferred airline?',
  hint:'If you fly one airline most of the time, I can find the card that maximizes that loyalty.',
  opts:[
    {v:'united',   e:'🔵', l:'United',           d:'I fly United most often'},
    {v:'american', e:'🔴', l:'American Airlines', d:'AA is my go-to carrier'},
    {v:'delta',    e:'🟣', l:'Delta',             d:'I prefer Delta'},
    {v:'none',     e:'🌐', l:'No preference',     d:'Show me the best overall travel card'},
  ], twoCol:true
};

// Which card IDs belong to each airline (co-branded only)
const AIRLINE_CARDS = {
  united:   ['united-gateway','united-explorer','united-quest','united-club'],
  american: ['aa-mileup','aa-platinum','aa-globe','aa-executive'],
  delta:    ['delta-blue','delta-gold','delta-plat','delta-reserve'],
};

// Transferable points card IDs (never suppressed in no-preference mode)
const TRANSFERABLE_IDS = ['csp','csr','amex-plat','amex-gold','venture-x','double-cash','cfu','citi-strata','citi-strata-premier','citi-strata-elite'];

// ═══ STATE ═══
let qIdx=0, answers={}, selVal=null, showingAirlineQ=false;

// ═══ SCREENS ═══
function show(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('s-'+id).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function startQuiz() { qIdx=0; answers={}; showingAirlineQ=false; show('quiz'); renderQ(); }
function restart() { show('hero'); }

// Returns true if this user should see the airline question
function shouldShowAirlineQ() {
  return answers.goal==='travel' || answers.goal==='both';
}

// ═══ QUIZ ═══
function renderQ() {
  const q = showingAirlineQ ? AIRLINE_Q : QS[qIdx];
  const totalQ = shouldShowAirlineQ() ? QS.length+1 : QS.length;
  const currentNum = showingAirlineQ ? QS.length+1 : qIdx+1;
  const pct = Math.round((currentNum/totalQ)*100);

  document.getElementById('q-label').textContent=`Question ${currentNum} of ${totalQ}`;
  document.getElementById('q-prog').style.width=pct+'%';

  // Dots — show one per real question + 1 extra dot if airline Q is coming/showing
  const dotCount = shouldShowAirlineQ() ? QS.length+1 : QS.length;
  document.getElementById('q-dots').innerHTML=Array.from({length:dotCount},(_,i)=>{
    const done = showingAirlineQ ? i<QS.length : i<qIdx;
    const active = showingAirlineQ ? i===QS.length : i===qIdx;
    return `<div class="dot ${done?'done':active?'active':''}"></div>`;
  }).join('');

  selVal = showingAirlineQ ? (answers.airline||null) : (answers[q.id]||null);

  document.getElementById('q-body').innerHTML=`
    <div class="q-icon">${q.icon}</div>
    <div class="q-text">${q.text}</div>
    <div class="q-hint">${q.hint}</div>
    <div class="options${q.twoCol?' two-col':''}">
      ${q.opts.map(o=>`
        <button class="opt${selVal===o.v?' sel':''}" onclick="pick('${o.v}',this)">
          <div class="opt-em">${o.e}</div>
          <div><div class="opt-lbl">${o.l}</div><div class="opt-desc">${o.d}</div></div>
        </button>`).join('')}
    </div>`;

  document.getElementById('btn-back').style.visibility=(qIdx===0&&!showingAirlineQ)?'hidden':'visible';
  const nb=document.getElementById('btn-next');
  selVal?nb.classList.add('on'):nb.classList.remove('on');
}

function pick(v,el) {
  document.querySelectorAll('.opt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  selVal=v;
  document.getElementById('btn-next').classList.add('on');
}

function goNext() {
  if(!selVal) return;
  if(showingAirlineQ) {
    answers.airline=selVal;
    showResults();
    return;
  }
  answers[QS[qIdx].id]=selVal;
  if(qIdx<QS.length-1) {
    qIdx++;
    renderQ();
  } else {
    // Last base question answered — check if airline Q is needed
    if(shouldShowAirlineQ()) {
      showingAirlineQ=true;
      renderQ();
    } else {
      answers.airline='none';
      showResults();
    }
  }
}

function goBack() {
  if(showingAirlineQ) {
    showingAirlineQ=false;
    renderQ();
    return;
  }
  if(qIdx>0){answers[QS[qIdx].id]=selVal;qIdx--;renderQ();}
}

// ═══ SCORING ═══

// Base scorer — used for all paths
function baseScore(c) {
  const w={goal:4,spend:3,fee:3,credit:5,travel:2};
  if(!c.creditReq.includes(answers.credit)) return 0;
  let s=0;
  const answersToScore={goal:answers.goal,spend:answers.spend,fee:answers.fee,credit:answers.credit,travel:answers.travel};
  for(const[k,v] of Object.entries(answersToScore))
    if(c.tags[k]&&c.tags[k].includes(v)) s+=w[k]||1;
  return s;
}

// All co-branded airline card IDs (flat list)
function allAirlineCardIds() {
  return Object.values(AIRLINE_CARDS).reduce((a,b)=>a.concat(b),[]);
}

function scoreCards() {
  const airline = answers.airline || 'none';

  // CASHBACK PATH — no airline cards ever
  if(answers.goal==='cashback') {
    return CARDS
      .filter(c=>!allAirlineCardIds().includes(c.id))
      .map(c=>({...c,score:baseScore(c)}))
      .filter(c=>c.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,3);
  }

  // SPECIFIC AIRLINE PATH
  if(airline!=='none') {
    const airlineIds = AIRLINE_CARDS[airline] || [];

    // Score and pick top 2 from chosen airline
    const airlineResults = CARDS
      .filter(c=>airlineIds.includes(c.id))
      .map(c=>({...c,score:baseScore(c)}))
      .filter(c=>c.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,2);

    // If fewer than 2 airline cards qualify, fill up
    const airlineFinal = airlineResults.length>0
      ? airlineResults
      : CARDS.filter(c=>airlineIds.includes(c.id)).slice(0,2);

    // Pick best transferable card that isn't an airline co-brand
    const transferable = CARDS
      .filter(c=>TRANSFERABLE_IDS.includes(c.id))
      .map(c=>({...c,score:baseScore(c)}))
      .filter(c=>c.score>0)
      .sort((a,b)=>b.score-a.score)[0];

    const results = [...airlineFinal];
    if(transferable) results.push(transferable);
    return results;
  }

  // NO PREFERENCE PATH — transferable cards biased up, airline co-brands suppressed
  return CARDS
    .filter(c=>!allAirlineCardIds().includes(c.id))
    .map(c=>({...c,score:baseScore(c)}))
    .filter(c=>c.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,3);
}

// ═══ RESULTS ═══
function showResults() {
  show('loading');
  setTimeout(()=>{
    const top=scoreCards();
    if(top.length===0) {
      const fallback=CARDS.filter(c=>c.annualFee===0&&!allAirlineCardIds().includes(c.id));
      buildResults(fallback.slice(0,2));
    } else {
      buildResults(top);
    }
    buildCalcInputs();
    show('results');
  },1700);
}

function buildResults(cards) {
  const airline=answers.airline||'none';
  const airlineNames={united:'United',american:'American Airlines',delta:'Delta'};
  const gMap={travel:'Travel Rewards',cashback:'Cash Back',both:'Flexible Rewards'};

  let title=`Your Top ${gMap[answers.goal]||'Rewards'} Picks`;
  let sub='Tap any card to see the full breakdown — credits, perks, and fee math included.';

  if(airline!=='none') {
    title=`Your Top ${airlineNames[airline]} Picks`;
    sub=`Your best ${airlineNames[airline]} cards for your spending profile — plus one transferable points alternative.`;
  }

  document.getElementById('r-title').textContent=title;
  document.getElementById('r-sub').textContent=sub;

  // For airline path: last card is the transferable alternative — label it differently
  const isAirlinePath = airline!=='none' && cards.length===3;
  const rankLabels=['🏆 Best Match','🥈 Runner-Up','💡 Also Consider: Transferable Points'];

  document.getElementById('r-cards').innerHTML=cards.map((c,i)=>{
    const label = isAirlinePath ? rankLabels[i] : ['🏆 Best Match','🥈 Runner-Up','🥉 Also Great'][i];
    return buildRC(c,i,label);
  }).join('');
}

function buildRC(c,rank,customLabel) {
  const isBest=rank===0;
  const ef=c.annualFee-c.totalCreditValue;
  const efText=ef<=0?`Net +$${Math.abs(ef)}/yr after credits`:`$${ef}/yr after credits`;
  const efColor=ef<=0?'color:var(--green-text)':'';

  const creditsHTML=c.credits.length?`
    <button class="credits-toggle" onclick="toggleCredits('${c.id}',this)">
      View all credits & benefits (${c.credits.length} items · $${c.totalCreditValue} total value) <span>▼</span>
    </button>
    <div class="credits-list" id="cr-${c.id}">
      ${c.credits.map(cr=>`
        <div class="credit-row">
          <div><div class="credit-name">${cr.name}</div><div class="credit-desc">${cr.desc}</div></div>
          <div class="credit-val">+$${cr.value}/yr</div>
        </div>`).join('')}
      <div class="effective-fee-row">
        <div><div class="ef-label">Effective Annual Fee</div><div class="ef-desc">If you use all the credits above</div></div>
        <div class="ef-val" style="${efColor}">${efText}</div>
      </div>
    </div>`
  :`<p style="font-size:0.78rem;color:var(--muted);font-style:italic;margin-bottom:18px">No annual credits — but no annual fee either.</p>`;

  const rankLabels=['🏆 Best Match','🥈 Runner-Up','🥉 Also Great'];

  return `
  <div class="result-card${isBest?' best':''}" id="rc-${c.id}">
    <div class="rc-top" onclick="toggleRC('${c.id}')">
      <div class="rc-left">
        <div class="rc-rank">${customLabel||rankLabels[rank]}</div>
        <div class="rc-name">${c.name}</div>
        <div class="rc-issuer">${c.issuer}</div>
      </div>
      <div class="rc-right">
        <div class="rc-fee-pill">${c.annualFeeDisplay}</div>
        <div class="rc-chevron">▼</div>
      </div>
    </div>
    <div class="rc-body">
      <div class="why-box">${c.why}</div>
      <div class="stats-row">
        <div class="stat"><div class="stat-val">${c.annualFeeDisplay}</div><div class="stat-lbl">Annual Fee</div></div>
        <div class="stat"><div class="stat-val">${c.signupBonus}</div><div class="stat-lbl">Welcome Bonus</div></div>
        <div class="stat"><div class="stat-val">${c.totalCreditValue>0?'$'+c.totalCreditValue+' back':'—'}</div><div class="stat-lbl">Credits Value</div></div>
      </div>
      ${creditsHTML}
      <div class="perks">${c.perks.map(p=>`<span class="perk">${p}</span>`).join('')}</div>
      <div class="apply-row">
        <button class="btn-apply" onclick="applyClick('${c.id}')">Apply Now →</button>
        <button class="btn-calc-jump" onclick="openModal('${c.id}')">See Full Details 📋</button>
      </div>
    </div>
  </div>`;
}

function toggleRC(id) {
  document.getElementById('rc-'+id).classList.toggle('open');
}

function toggleCredits(id,btn) {
  const el=document.getElementById('cr-'+id);
  el.classList.toggle('open');
  btn.querySelector('span').textContent=el.classList.contains('open')?'▲':'▼';
}

function applyClick(id) {
  const c=CARDS.find(x=>x.id===id);
  if(c.applyUrl&&c.applyUrl!=='#') window.open(c.applyUrl,'_blank');
  else alert(`In the live version this opens ${c.name}'s application. Add your referral link in the applyUrl field.`);
}

// ═══ TABS ═══
function switchTab(id,btn) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
  window.scrollTo({top:document.querySelector('.results-header').offsetTop-20,behavior:'smooth'});
}

// ═══ CALCULATOR ═══
function buildCalcInputs() {
  document.getElementById('spend-inputs').innerHTML=CATS.map(c=>`
    <div class="spend-field">
      <label>${c.label}</label>
      <div class="input-wrap">
        <input type="number" id="sp-${c.id}" placeholder="${c.ph}" min="0" inputmode="numeric"
          oninput="document.getElementById('calc-results').classList.remove('show')">
      </div>
    </div>`).join('');
}

function runCalc() {
  const spend={};
  let hasAny=false;
  CATS.forEach(c=>{
    const v=parseFloat(document.getElementById('sp-'+c.id).value)||0;
    spend[c.id]=v;
    if(v>0) hasAny=true;
  });

  if(!hasAny){ alert('Enter at least one monthly spend amount to calculate.'); return; }

  const results=CARDS.map(c=>{
    let annual=0;
    CATS.forEach(cat=>{ annual+=spend[cat.id]*12*(c.earn[cat.id]||1)*c.pointValue; });
    const net=Math.round(annual)-c.annualFee+c.totalCreditValue;
    return {...c, annualRewards:Math.round(annual), netValue:net};
  }).sort((a,b)=>b.netValue-a.netValue);

  let html=`
    <div class="calc-results-title">Annual Value Comparison</div>
    <div class="calc-results-sub">Rewards earned + credits − annual fee = net value to you</div>`;

  results.forEach((c,i)=>{
    const win=i===0;
    html+=`
    <div class="calc-card${win?' winner':''}">
      <div class="calc-top">
        <div>
          <div class="calc-card-name">${c.name}${win?'<span class="winner-tag">Best Value</span>':''}</div>
          <div class="calc-card-issuer">${c.issuer} · ${c.annualFeeDisplay}</div>
        </div>
        <div style="text-align:right">
          <div class="net-val ${c.netValue>=0?'pos':'neg'}">${c.netValue>=0?'+':''}$${c.netValue}</div>
          <div class="net-val-lbl">Annual Net Value</div>
        </div>
      </div>
      <div class="calc-breakdown">
        <div class="cb-stat"><div class="cb-val g">+$${c.annualRewards}</div><div class="cb-lbl">Rewards Earned</div></div>
        <div class="cb-stat"><div class="cb-val g">+$${c.totalCreditValue}</div><div class="cb-lbl">Credits Value</div></div>
        <div class="cb-stat"><div class="cb-val${c.annualFee>0?' r':''}">−$${c.annualFee}</div><div class="cb-lbl">Annual Fee</div></div>
      </div>
    </div>`;
  });

  html+=`<div class="calc-footnote">How to read this: "Rewards Earned" is based on your spend inputs and each card's actual earn rates — flights and hotels are split out because the difference matters (Amex Platinum earns 5x on flights booked directly but only 1x on hotels booked outside Amex Travel, for example). "Credits Value" assumes you use all annual credits — be honest with yourself about that. Point values use conservative estimates (Chase at 1.25¢, Amex/C1 at 1¢). Transferring to airline partners can push those values significantly higher. Always verify current terms before applying.</div>`;

  const el=document.getElementById('calc-results');
  el.innerHTML=html;
  el.classList.add('show');
}

// ═══ BROWSE ═══

// Category tags per card — a card can belong to multiple

let activeBrowseFilter = 'all';

function initBrowse() {
  renderBrowseCards('all');
}

function filterCards(cat, btn) {
  activeBrowseFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBrowseCards(cat);
}

function renderBrowseCards(cat) {
  const filtered = CARDS.filter(c => {
    if (cat === 'all') return true;
    return (BROWSE_CATS[c.id] || []).includes(cat);
  });

  const grid = document.getElementById('browse-grid');

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="browse-empty">No cards in this category yet — more coming soon.</div>';
    return;
  }

  grid.innerHTML = filtered.map(c => buildBrowseCard(c)).join('');
}

function buildBrowseCard(c) {
  const cats = BROWSE_CATS[c.id] || [];
  const tagsHTML = cats.map(t =>
    `<span class="bc-tag ${TAG_META[t].cls}">${TAG_META[t].label}</span>`
  ).join('');

  const ef = c.annualFee - c.totalCreditValue;
  const efText = ef <= 0
    ? `Net +$${Math.abs(ef)}/yr after credits`
    : `$${ef}/yr after credits`;

  return `
  <div class="browse-card" id="bc-${c.id}">
    <div class="bc-top" onclick="toggleBrowseCard('${c.id}')">
      <div class="bc-left">
        <div class="bc-name">${c.name}</div>
        <div class="bc-issuer">${c.issuer}</div>
      </div>
      <div class="bc-right">
        <div class="bc-tags">${tagsHTML}</div>
        <div class="bc-chevron">▼</div>
      </div>
    </div>
    <div class="bc-body">
      <div class="bc-quickstats">
        <div class="bc-stat">
          <div class="bc-stat-val">${c.annualFeeDisplay}</div>
          <div class="bc-stat-lbl">Annual Fee</div>
        </div>
        <div class="bc-stat">
          <div class="bc-stat-val">${c.signupBonus}</div>
          <div class="bc-stat-lbl">Welcome Bonus</div>
        </div>
        <div class="bc-stat">
          <div class="bc-stat-val">${c.totalCreditValue > 0 ? '$' + c.totalCreditValue + ' credits' : '—'}</div>
          <div class="bc-stat-lbl">${c.totalCreditValue > 0 ? efText : 'No fee'}</div>
        </div>
      </div>
      <div class="bc-why">${c.why}</div>
      <div class="bc-perks">${c.perks.slice(0,4).map(p => `<span class="bc-perk">${p}</span>`).join('')}</div>
      <div class="bc-actions">
        <button class="bc-apply" onclick="applyClick('${c.id}')">Apply Now →</button>
        <button class="bc-quiz-link" onclick="openModal('${c.id}')">See Full Details 📋</button>
      </div>
    </div>
  </div>`;
}

function toggleBrowseCard(id) {
  document.getElementById('bc-' + id).classList.toggle('open');
}

// Initialize browse on page load
// ═══ DETAIL MODAL ═══

const EARN_LABELS = {
  groceries: 'Groceries',
  dining: 'Dining',
  flights: 'Flights',
  hotels: 'Hotels',
  gas: 'Gas',
  streaming: 'Streaming',
  shopping: 'Shopping',
  everything: 'Everything Else'
};

function openModal(id) {
  const c = CARDS.find(function(x){ return x.id === id; });
  if (!c) return;

  // Header
  document.getElementById('m-name').textContent = c.name;
  document.getElementById('m-issuer').textContent = c.issuer;

  // Meta row
  const ef = c.annualFee - c.totalCreditValue;
  const efText = ef <= 0 ? 'Net +$' + Math.abs(ef) + ' after credits' : '$' + ef + ' effective fee';
  document.getElementById('m-meta').innerHTML =
    '<div class="modal-meta-item"><div class="modal-meta-val">' + c.annualFeeDisplay + '</div><div class="modal-meta-lbl">Annual Fee</div></div>' +
    '<div class="modal-meta-item"><div class="modal-meta-val">' + c.signupBonus + '</div><div class="modal-meta-lbl">Welcome Bonus</div></div>' +
    '<div class="modal-meta-item"><div class="modal-meta-val">' + (c.totalCreditValue > 0 ? '$' + c.totalCreditValue : '—') + '</div><div class="modal-meta-lbl">Credits Value</div></div>' +
    '<div class="modal-meta-item"><div class="modal-meta-val">' + efText + '</div><div class="modal-meta-lbl">Real Cost</div></div>';

  // Earn rates
  const maxRate = Math.max.apply(null, Object.values(c.earn));
  const earnHTML = Object.entries(c.earn).map(function(entry) {
    const cat = entry[0], rate = entry[1];
    const isTop = rate === maxRate && rate > 1;
    return '<div class="earn-cell' + (isTop ? ' top-earn' : '') + '">' +
      '<div class="earn-rate">' + rate + 'x</div>' +
      '<div class="earn-cat">' + EARN_LABELS[cat] + '</div>' +
      '</div>';
  }).join('');
  document.getElementById('m-earn').innerHTML = earnHTML;

  // Credits
  if (c.credits.length > 0) {
    const rows = c.credits.map(function(cr) {
      return '<tr><td class="credit-td-name">' + cr.name + '</td>' +
        '<td class="credit-td-desc">' + cr.desc + '</td>' +
        '<td class="credit-td-val">+$' + cr.value + '</td></tr>';
    }).join('');
    const total = '<tr class="total-row">' +
      '<td class="credit-td-name">Total Credit Value</td>' +
      '<td class="credit-td-desc">Sum of all credits above (assuming full use)</td>' +
      '<td class="credit-td-val">$' + c.totalCreditValue + '</td></tr>';
    document.getElementById('m-credits').innerHTML =
      '<table class="credits-table">' + rows + total + '</table>';
  } else {
    document.getElementById('m-credits').innerHTML =
      '<p class="no-credits-note">This card has no annual credits — but also no annual fee to offset. Every dollar earned goes straight to your pocket.</p>';
  }

  // Fee math
  const effectiveFee = c.annualFee - c.totalCreditValue;
  const isPositive = effectiveFee <= 0;
  const feeMathRows = [
    { label: 'Annual Fee', val: '-$' + c.annualFee, cls: c.annualFee > 0 ? 'red' : '' },
    { label: 'Total Credits Value (if fully used)', val: '+$' + c.totalCreditValue, cls: c.totalCreditValue > 0 ? 'green' : '' },
  ];
  const feeMathHTML = feeMathRows.map(function(r) {
    return '<div class="fee-math-row"><div class="fee-math-label">' + r.label + '</div>' +
      '<div class="fee-math-val ' + r.cls + '">' + r.val + '</div></div>';
  }).join('') +
  '<div class="fee-math-row result-row' + (isPositive ? '' : ' negative') + '">' +
  '<div class="fee-math-label">Effective Annual Fee</div>' +
  '<div class="fee-math-val">' + (isPositive ? 'Net +$' + Math.abs(effectiveFee) : '$' + effectiveFee) + '</div>' +
  '</div>';
  document.getElementById('m-feemath').innerHTML = feeMathHTML;

  // Caveat
  const caveatText = c.credits.length > 0
    ? 'This assumes you use 100% of every credit listed above. In practice, your effective fee depends on which credits actually fit your lifestyle. The credits that require specific spending at specific merchants (like Resy, Dunkin\', Equinox) are worth full value only if you\'d use them anyway.'
    : 'No annual fee means every reward you earn is pure value with no offset needed.';
  document.getElementById('m-caveat').textContent = caveatText;

  // Buttons
  const applyBtn = document.getElementById('m-apply');
  applyBtn.onclick = function() { applyClick(c.id); };

  const officialLink = document.getElementById('m-official');
  officialLink.href = c.officialUrl || c.applyUrl || '#';

  // Open modal
  document.getElementById('detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('detail-modal')) closeModal();
}

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

document.addEventListener('DOMContentLoaded', initBrowse);

// Expose functions used by inline onclick handlers in HTML
window.startQuiz = startQuiz;
window.restart = restart;
window.goNext = goNext;
window.goBack = goBack;
window.pick = pick;
window.switchTab = switchTab;
window.runCalc = runCalc;
window.filterCards = filterCards;
window.toggleRC = toggleRC;
window.toggleCredits = toggleCredits;
window.applyClick = applyClick;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOutside = closeModalOutside;
window.toggleBrowseCard = toggleBrowseCard;
