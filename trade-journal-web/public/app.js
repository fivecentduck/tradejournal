(() => {
'use strict';

/* =====================================================
   Helpers
   ===================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayKey() { return nowLocal().slice(0, 10); }
function parseLocal(s) { return new Date(s); } // 'YYYY-MM-DDTHH:mm' is parsed as local time
function dayLabel(key, withYear) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}
function fmtDateTime(s) {
  if (!s) return '';
  return parseLocal(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDur(ms) {
  if (!(ms >= 0)) return '-';
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}
const money = (n, signed = false) => {
  if (!isFinite(n)) return '-';
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : signed && n > 0 ? '+' : '') + '$' + s;
};
const cls = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
const priceStr = (n) => (n == null ? '' : String(round(n, 5)));

/* =====================================================
   Data: contracts, themes, tips
   ===================================================== */
// [symbol, name, tickSize, tickValue, fee per contract per side]
const DEFAULT_CONTRACTS = [
  ['ES',  'E-mini S&P 500',        0.25,  12.5, 1.25],
  ['MES', 'Micro E-mini S&P 500',  0.25,  1.25, 0.40],
  ['NQ',  'E-mini Nasdaq-100',     0.25,  5,    1.25],
  ['MNQ', 'Micro E-mini Nasdaq-100', 0.25, 0.5, 0.40],
  ['NNQ', 'Nano Nasdaq-100 ($0.20/pt)', 0.25, 0.05, 0.10],
  ['YM',  'E-mini Dow',            1,     5,    1.25],
  ['MYM', 'Micro E-mini Dow',      1,     0.5,  0.40],
  ['RTY', 'E-mini Russell 2000',   0.1,   5,    1.25],
  ['M2K', 'Micro E-mini Russell 2000', 0.1, 0.5, 0.40],
  ['CL',  'Crude Oil',             0.01,  10,   1.50],
  ['MCL', 'Micro Crude Oil',       0.01,  1,    0.50],
  ['GC',  'Gold',                  0.1,   10,   1.50],
  ['MGC', 'Micro Gold',            0.1,   1,    0.50],
  ['SI',  'Silver',                0.005, 25,   1.50],
  ['SIL', 'Micro Silver (1000 oz)', 0.005, 5,   0.75]
].map(([symbol, name, tickSize, tickValue, fee]) => ({ symbol, name, tickSize, tickValue, fee, custom: false }));

const THEMES = {
  daylight: { name: 'Daylight', dark: false, bg: '#f4f6f9', surface: '#ffffff', text: '#171a21', accent: '#2563eb', up: '#16a34a', down: '#dc2626' },
  latte:    { name: 'Latte',    dark: false, bg: '#efe7dc', surface: '#faf6ef', text: '#2b231c', accent: '#7c4f2a', up: '#3b7a4b', down: '#b0402f' },
  midnight: { name: 'Midnight', dark: true,  bg: '#0e131b', surface: '#171d28', text: '#e6e9ef', accent: '#5aa7ff', up: '#3fbf84', down: '#f0616d' },
  obsidian: { name: 'Obsidian', dark: true,  bg: '#09090a', surface: '#141416', text: '#ece8df', accent: '#f2a93b', up: '#6fcf97', down: '#eb5757' }
};
const DEFAULT_CUSTOM = {
  custom1: { name: 'Custom 1', bg: '#1a1426', surface: '#241b35', text: '#efe9fb', accent: '#b388ff', up: '#5fe3a1', down: '#ff6b8b' },
  custom2: { name: 'Custom 2', bg: '#e9f4f2', surface: '#f8fffd', text: '#12302b', accent: '#0f9d8a', up: '#1f9a55', down: '#d6455d' }
};
const COLOR_KEYS = [['bg', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['accent', 'Accent'], ['up', 'Profit'], ['down', 'Loss']];

const STYLES = {
  minimal: { name: 'Minimalist', desc: 'Clean, quiet, lots of space.' },
  plain:   { name: 'Plaintext',  desc: 'Early-internet: serif type, bordered tables, beveled buttons.' },
  aurora:  { name: 'Aurora',     desc: 'Frosted glass over soft glowing color.' }
};

const TIPS = [
  'Risk a small, fixed fraction of your account on every trade, and stick to it.',
  'Decide your stop before you enter, not after the trade goes against you.',
  'Moving a stop further away is how small losses become large ones.',
  'A good journal entry records why you took the trade, not only how it ended.',
  'Your edge only shows up over many trades. One trade proves almost nothing.',
  'After a big win, the next trade is just as likely to be sloppy as after a big loss.',
  'Cut size, not rules, when you are on a losing streak.',
  'Fees and slippage are a guaranteed cost on every trade. Track them.',
  'A daily max loss limit protects you from your worst day becoming your worst month.',
  'Trade the plan you wrote when you were calm.',
  'Review your losing trades as carefully as your winners.',
  'Fewer, better setups beat constant activity.',
  'Know the news times for the products you trade before the session begins.',
  'Be wary of revenge trading: the market does not owe you anything back.',
  'Position size is the one variable you fully control. Use it.',
  'Write down how you felt before entering. Patterns show up quickly.',
  'Liquidity is thinnest at the open and close of overnight sessions. Expect wider spreads.',
  'A strategy with a 40% win rate can be profitable if winners are larger than losers.',
  'Take a break after any trade you did not plan to take.',
  'Consistency in process comes before consistency in profit.'
];

/* =====================================================
   State
   ===================================================== */
const PREF_KEY = 'tradejournal.prefs.v1'; // theme/style prefs cached locally so the sign-in screen matches
function defaultState() {
  return {
    version: 1,
    startingBalance: 10000,
    trades: [],
    contracts: DEFAULT_CONTRACTS.map(c => ({ ...c })),
    settings: {
      theme: 'midnight', style: 'minimal', loading: true, animations: true,
      customThemes: JSON.parse(JSON.stringify(DEFAULT_CUSTOM)), lastView: 'overview', lastSymbol: 'ES'
    }
  };
}
function normalize(s, d = defaultState()) {
  const out = { ...d, ...s };
  out.settings = { ...d.settings, ...(s.settings || {}) };
  out.settings.customThemes = {
    custom1: { ...DEFAULT_CUSTOM.custom1, ...(s.settings?.customThemes?.custom1 || {}) },
    custom2: { ...DEFAULT_CUSTOM.custom2, ...(s.settings?.customThemes?.custom2 || {}) }
  };
  if (!Array.isArray(out.trades)) out.trades = [];
  if (!Array.isArray(out.contracts)) out.contracts = [];
  out.contracts = out.contracts.filter(c => c && c.symbol).map(c => ({
    symbol: String(c.symbol), name: String(c.name || c.symbol), tickSize: Number(c.tickSize) || 0.01,
    tickValue: Number(c.tickValue) || 1, fee: Number(c.fee) || 0, custom: !!c.custom
  }));
  if (!out.contracts.length) out.contracts = d.contracts;
  out.trades = out.trades.filter(t => t && typeof t === 'object').map(t => ({
    id: String(t.id || uid()), symbol: String(t.symbol || ''), side: t.side === 'short' ? 'short' : 'long',
    qty: Number(t.qty) || 1, entryPrice: Number(t.entryPrice), entryTime: String(t.entryTime || ''),
    exitPrice: t.exitPrice == null ? null : Number(t.exitPrice), exitTime: t.exitTime ? String(t.exitTime) : null,
    fee: Number(t.fee) || 0, tick: Number(t.tick) || 0.01, pv: Number(t.pv) || 1, notes: String(t.notes || '')
  }));
  if (!out.contracts.some(c => c.symbol === 'NNQ') && !(s.seeded || []).includes('NNQ')) {
    const i = out.contracts.findIndex(c => c.symbol === 'MNQ');
    const nnq = { ...DEFAULT_CONTRACTS.find(c => c.symbol === 'NNQ') };
    out.contracts.splice(i >= 0 ? i + 1 : out.contracts.length, 0, nnq);
  }
  out.seeded = Array.from(new Set([...(s.seeded || []), 'NNQ']));
  out.startingBalance = Number.isFinite(+out.startingBalance) ? +out.startingBalance : 10000;
  return out;
}
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } }
let state = normalize({ settings: loadPrefs() });
let user = null, dirty = false, saving = false, saveTimer = null, failing = false, syncText = '';

function setSync(t) { syncText = t; const el = $('#sync'); if (el) el.textContent = t; }
function save() {
  try {
    const p = state.settings;
    localStorage.setItem(PREF_KEY, JSON.stringify({ theme: p.theme, style: p.style, loading: p.loading, animations: p.animations, customThemes: p.customThemes }));
  } catch (e) { /* ignore */ }
  if (!user) return;
  dirty = true; setSync('Saving...');
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600);
}
async function flush() {
  if (!dirty || !user) return;
  if (saving) { saveTimer = setTimeout(flush, 300); return; }
  saving = true; dirty = false;
  try {
    const r = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
    if (r.status === 401) { sessionExpired(); return; }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Could not save'); }
    failing = false; setSync('Saved');
  } catch (e) {
    dirty = true; setSync('Not saved');
    if (!failing) toast((e.message || 'Could not save') + '. Retrying...');
    failing = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 6000);
  } finally { saving = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && dirty && user) {
    try { if (navigator.sendBeacon('/api/data', new Blob([JSON.stringify({ state })], { type: 'application/json' }))) dirty = false; } catch (e) { /* ignore */ }
  }
});

const ui = {
  view: state.settings.lastView || 'overview',
  cal: { y: new Date().getFullYear(), m: new Date().getMonth() },
  selDay: null,
  filter: { q: '', side: 'all', result: 'all' },
  chartMode: 'equity', chartRange: 'all'
};

const getContract = sym => state.contracts.find(c => c.symbol === sym);
const pointValue = c => round(c.tickValue / c.tickSize);

/* =====================================================
   Calculations
   ===================================================== */
function calc(t) {
  if (t.exitPrice == null) return null;
  const dir = t.side === 'long' ? 1 : -1;
  const pts = (t.exitPrice - t.entryPrice) * dir;
  const gross = pts * t.pv * t.qty;
  const fees = t.fee * t.qty * 2;
  return { pts, gross, fees, net: gross - fees, ticks: pts / t.tick };
}
const isOpen = t => t.exitPrice == null;
const closedTrades = () => state.trades.filter(t => !isOpen(t));
const openTrades = () => state.trades.filter(isOpen);
const exitDay = t => t.exitTime.slice(0, 10);

function computeStats(trades) {
  let net = 0, gw = 0, gl = 0, w = 0, l = 0, fees = 0, best = null, worst = null;
  const closed = trades.filter(t => !isOpen(t));
  closed.forEach(t => {
    const c = calc(t); net += c.net; fees += c.fees;
    if (c.net > 0) { w++; gw += c.net; } else if (c.net < 0) { l++; gl += -c.net; }
    if (!best || c.net > best.net) best = { net: c.net, t };
    if (!worst || c.net < worst.net) worst = { net: c.net, t };
  });
  const n = closed.length;
  return {
    n, net, w, l, fees, best, worst,
    winRate: n ? (w / n) * 100 : 0,
    pf: gl ? gw / gl : (gw ? Infinity : 0),
    avgW: w ? gw / w : 0, avgL: l ? gl / l : 0
  };
}
function dayMap() {
  const map = {};
  closedTrades().forEach(t => {
    const k = exitDay(t);
    const o = map[k] || (map[k] = { net: 0, n: 0, w: 0 });
    o.net += calc(t).net; o.n++; if (calc(t).net > 0) o.w++;
  });
  return map;
}
const balanceNow = () => state.startingBalance + computeStats(state.trades).net;

/* =====================================================
   Theme / style / animations
   ===================================================== */
function activeTheme() {
  const id = state.settings.theme;
  return THEMES[id] || state.settings.customThemes[id] || THEMES.midnight;
}
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0;
  const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function applyTheme(animate) {
  const t = activeTheme(), root = document.documentElement;
  if (animate && state.settings.animations) {
    root.classList.add('theme-anim');
    clearTimeout(applyTheme._t);
    applyTheme._t = setTimeout(() => root.classList.remove('theme-anim'), 480);
  }
  COLOR_KEYS.forEach(([k]) => root.style.setProperty('--' + k, t[k]));
  root.style.setProperty('--accent-ink', luminance(t.accent) > 0.42 ? '#111111' : '#ffffff');
  root.style.colorScheme = luminance(t.bg) < 0.3 ? 'dark' : 'light';
}
function applyStyle() { document.documentElement.dataset.style = state.settings.style; }
function applyAnim() { document.documentElement.dataset.anim = state.settings.animations ? 'on' : 'off'; }

/* =====================================================
   Icons / nav
   ===================================================== */
const ICON = {
  overview: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  trades: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M3 17l6-6 4 4 8-9"/>',
  contracts: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
};
const VIEWS = [
  ['overview', 'Overview'], ['trades', 'Trade log'], ['calendar', 'P&L calendar'],
  ['chart', 'P&L chart'], ['contracts', 'Contracts'], ['settings', 'Settings']
];
function renderNav() {
  $('#nav').innerHTML = VIEWS.map(([id, label]) =>
    `<button data-nav="${id}" class="${ui.view === id ? 'active' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>${label}</button>`
  ).join('');
  const s = computeStats(state.trades);
  $('#sideFoot').innerHTML = `<div class="who">${user ? esc(user.username) : ''} <span id="sync" class="mut">${esc(syncText)}</span></div>Balance<b class="num">${money(state.startingBalance + s.net)}</b><span class="${cls(s.net)}">${money(s.net, true)} all time</span>`;
}

/* =====================================================
   Views
   ===================================================== */
function statCard(i, label, value, fmt, sub, klass = '') {
  const shown = fmtVal(value, fmt);
  return `<div class="card stat" style="--i:${i}"><div class="k">${label}</div><div class="v ${klass}" data-count="${isFinite(value) ? value : ''}" data-fmt="${fmt}">${shown}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
}
function fmtVal(v, fmt) {
  switch (fmt) {
    case 'money': return money(v);
    case 'smoney': return money(v, true);
    case 'pct': return v.toFixed(1) + '%';
    case 'pf': return v === Infinity ? '∞' : (v ? v.toFixed(2) : '-');
    default: return String(Math.round(v));
  }
}

function viewOverview() {
  const s = computeStats(state.trades);
  const today = dayMap()[todayKey()];
  const open = openTrades().sort((a, b) => a.entryTime < b.entryTime ? 1 : -1);
  const recent = closedTrades().sort((a, b) => a.exitTime < b.exitTime ? 1 : -1).slice(0, 6);

  const posRows = open.map((t, i) => `
    <div class="pos-row" data-row="${t.id}" style="--i:${i}">
      <div><div class="big sym">${esc(t.symbol)} <span class="pill ${t.side}">${t.side === 'long' ? 'Long' : 'Short'}</span></div>
        <div class="small">${t.qty} contract${t.qty > 1 ? 's' : ''}</div></div>
      <div><div class="num">Entry <b>${priceStr(t.entryPrice)}</b></div>
        <div class="small">${fmtDateTime(t.entryTime)} · held <span data-since="${t.entryTime}">${fmtDur(Date.now() - parseLocal(t.entryTime))}</span></div></div>
      <div class="small">1 point = ${money(t.pv * t.qty)}<br>fees est. ${money(t.fee * t.qty * 2)}</div>
      <div class="actions">
        <button class="btn primary sm" data-act="close" data-id="${t.id}">Close</button>
        <button class="btn sm" data-act="edit" data-id="${t.id}">Edit</button>
        <button class="btn sm danger" data-act="del" data-id="${t.id}">Delete</button>
      </div>
    </div>`).join('');

  const recentRows = recent.map((t, i) => {
    const c = calc(t);
    return `<tr style="--i:${i}"><td>${fmtDateTime(t.exitTime)}</td><td class="sym">${esc(t.symbol)}</td><td><span class="pill ${t.side}">${t.side}</span></td>
      <td class="r num">${t.qty}</td><td class="r num ${cls(c.net)}"><b>${money(c.net, true)}</b></td></tr>`;
  }).join('');

  return `
  <div class="head"><div><h1>Overview</h1><div class="sub">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>
    <div class="actions"><button class="btn" data-act="new-open">Add open position</button><button class="btn primary" data-act="new-closed">Add completed trade</button></div></div>
  <div class="grid stats">
    <div class="card stat" style="--i:0"><div class="k">Account balance</div><div class="v num" data-count="${state.startingBalance + s.net}" data-fmt="money">${money(state.startingBalance + s.net)}</div>
      <div class="s">Started at ${money(state.startingBalance)} <button class="btn ghost sm" data-act="balance" style="padding:1px 7px;margin-left:4px">Edit</button></div></div>
    ${statCard(1, 'Total P&L', s.net, 'smoney', `${s.n} closed trade${s.n === 1 ? '' : 's'}`, cls(s.net))}
    ${statCard(2, "Today's P&L", today ? today.net : 0, 'smoney', today ? `${today.n} trade${today.n === 1 ? '' : 's'}` : 'No trades yet', cls(today ? today.net : 0))}
    ${statCard(3, 'Win rate', s.winRate, 'pct', `${s.w}W / ${s.l}L`)}
    ${statCard(4, 'Profit factor', s.pf, 'pf', `Avg win ${money(s.avgW)} · loss ${money(s.avgL)}`)}
  </div>
  <div class="card"><h2>Open positions <span class="mut" style="font-weight:400">${open.length}</span></h2>
    ${open.length ? `<div class="poslist">${posRows}</div>` :
      `<div class="empty">No open positions.<br><button class="btn primary" data-act="new-open">Add open position</button></div>`}</div>
  <div class="card"><h2>Recent trades <button class="btn sm" data-nav="trades">View all</button></h2>
    ${recent.length ? `<div class="tablewrap"><table><thead><tr><th>Closed</th><th>Contract</th><th>Side</th><th class="r">Qty</th><th class="r">Net P&L</th></tr></thead><tbody>${recentRows}</tbody></table></div>` :
      `<div class="empty">Closed trades will show up here.</div>`}</div>`;
}

function viewTrades() {
  const f = ui.filter;
  let list = state.trades.slice().sort((a, b) => ((b.exitTime || b.entryTime) > (a.exitTime || a.entryTime) ? 1 : -1));
  if (f.q) list = list.filter(t => t.symbol.toLowerCase().includes(f.q.toLowerCase()) || (t.notes || '').toLowerCase().includes(f.q.toLowerCase()));
  if (f.side !== 'all') list = list.filter(t => t.side === f.side);
  if (f.result === 'open') list = list.filter(isOpen);
  if (f.result === 'win') list = list.filter(t => !isOpen(t) && calc(t).net > 0);
  if (f.result === 'loss') list = list.filter(t => !isOpen(t) && calc(t).net < 0);
  const tot = computeStats(list);

  const rows = list.map((t, i) => {
    const c = calc(t);
    return `<tr data-row="${t.id}" style="--i:${Math.min(i, 24)}">
      <td>${fmtDateTime(t.entryTime)}</td>
      <td>${t.exitTime ? fmtDateTime(t.exitTime) : '<span class="pill open">Open</span>'}</td>
      <td class="sym">${esc(t.symbol)}</td><td><span class="pill ${t.side}">${t.side === 'long' ? 'Long' : 'Short'}</span></td>
      <td class="r num">${t.qty}</td><td class="r num">${priceStr(t.entryPrice)}</td><td class="r num">${t.exitPrice == null ? '-' : priceStr(t.exitPrice)}</td>
      <td class="r num">${c ? fmtDur(parseLocal(t.exitTime) - parseLocal(t.entryTime)) : '-'}</td>
      <td class="r num">${c ? (c.ticks >= 0 ? '+' : '') + round(c.ticks, 1) : '-'}</td>
      <td class="r num mut">${c ? money(c.fees) : '-'}</td>
      <td class="r num ${c ? cls(c.net) : ''}"><b>${c ? money(c.net, true) : '-'}</b></td>
      <td class="r">${isOpen(t) ? `<button class="btn sm primary" data-act="close" data-id="${t.id}">Close</button> ` : ''}<button class="btn sm" data-act="edit" data-id="${t.id}">Edit</button> <button class="btn sm danger" data-act="del" data-id="${t.id}">Delete</button></td>
    </tr>${t.notes ? `<tr class="notes-row"><td colspan="12" class="mut" style="padding-top:0;white-space:normal">↳ ${esc(t.notes)}</td></tr>` : ''}`;
  }).join('');

  return `
  <div class="head"><div><h1>Trade log</h1><div class="sub">${list.length} trade${list.length === 1 ? '' : 's'} · net <span class="${cls(tot.net)}">${money(tot.net, true)}</span></div></div>
    <div class="actions"><button class="btn" data-act="new-open">Add open position</button><button class="btn primary" data-act="new-closed">Add completed trade</button></div></div>
  <div class="card">
    <div class="actions" style="margin-bottom:12px">
      <input type="search" id="fq" placeholder="Search contract or notes" value="${esc(f.q)}" style="max-width:240px">
      <select id="fside" style="width:auto"><option value="all">All sides</option><option value="long" ${f.side === 'long' ? 'selected' : ''}>Long</option><option value="short" ${f.side === 'short' ? 'selected' : ''}>Short</option></select>
      <select id="fres" style="width:auto"><option value="all">All results</option><option value="open" ${f.result === 'open' ? 'selected' : ''}>Open</option><option value="win" ${f.result === 'win' ? 'selected' : ''}>Winners</option><option value="loss" ${f.result === 'loss' ? 'selected' : ''}>Losers</option></select>
    </div>
    ${list.length ? `<div class="tablewrap"><table><thead><tr><th>Entered</th><th>Exited</th><th>Contract</th><th>Side</th><th class="r">Qty</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Held</th><th class="r">Ticks</th><th class="r">Fees</th><th class="r">Net P&L</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` :
      `<div class="empty">${state.trades.length ? 'No trades match these filters.' : 'No trades yet.<br><button class="btn primary" data-act="new-closed">Add your first trade</button>'}</div>`}
  </div>`;
}

function viewCalendar() {
  const { y, m } = ui.cal, map = dayMap();
  const first = new Date(y, m, 1), startOffset = first.getDay();
  const gridStart = new Date(y, m, 1 - startOffset);
  const weeks = Math.ceil((startOffset + new Date(y, m + 1, 0).getDate()) / 7);
  let maxAbs = 1, monthNet = 0, monthDays = 0, monthWins = 0, monthTrades = 0;
  Object.entries(map).forEach(([k, v]) => {
    const [ky, km] = k.split('-').map(Number);
    if (ky === y && km - 1 === m) { monthNet += v.net; monthDays++; monthTrades += v.n; if (v.net > 0) monthWins++; maxAbs = Math.max(maxAbs, Math.abs(v.net)); }
  });
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const tk = todayKey();
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map(d => `<div class="dow">${d}</div>`).join('');
  let idx = 0;
  for (let w = 0; w < weeks; w++) {
    let wkNet = 0, wkN = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d);
      const k = key(date), info = map[k], inMonth = date.getMonth() === m;
      if (info && inMonth) { wkNet += info.net; wkN += info.n; }
      const tint = info ? Math.round(14 + 40 * Math.min(1, Math.abs(info.net) / maxAbs)) : 0;
      cells += `<div class="cell ${inMonth ? '' : 'other'} ${info ? 'has ' + (info.net >= 0 ? 'up' : 'dn') : ''} ${k === tk ? 'today' : ''} ${ui.selDay === k ? 'sel' : ''}" ${info ? `data-day="${k}"` : ''} style="--i:${idx++};--tint:${tint}">
        <span class="d">${date.getDate()}</span>
        ${info ? `<span class="p ${cls(info.net)}">${money(info.net, true)}</span><span class="n">${info.n} trade${info.n > 1 ? 's' : ''}</span>` : '<span></span><span></span>'}</div>`;
    }
    cells += `<div class="cell week" style="--i:${idx++}"><span class="d">Week ${w + 1}</span>${wkN ? `<span class="p ${cls(wkNet)}">${money(wkNet, true)}</span><span class="n">${wkN} trade${wkN > 1 ? 's' : ''}</span>` : '<span></span><span></span>'}</div>`;
  }

  let detail = '';
  if (ui.selDay && map[ui.selDay]) {
    const list = closedTrades().filter(t => exitDay(t) === ui.selDay).sort((a, b) => a.exitTime > b.exitTime ? 1 : -1);
    detail = `<div class="card"><h2>${dayLabel(ui.selDay, true)} <span class="${cls(map[ui.selDay].net)} num">${money(map[ui.selDay].net, true)}</span></h2>
      <div class="tablewrap"><table><thead><tr><th>Entered</th><th>Exited</th><th>Contract</th><th>Side</th><th class="r">Qty</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Net P&L</th></tr></thead><tbody>
      ${list.map((t, i) => { const c = calc(t); return `<tr style="--i:${i}"><td>${fmtDateTime(t.entryTime)}</td><td>${fmtDateTime(t.exitTime)}</td><td class="sym">${esc(t.symbol)}</td><td><span class="pill ${t.side}">${t.side}</span></td><td class="r num">${t.qty}</td><td class="r num">${priceStr(t.entryPrice)}</td><td class="r num">${priceStr(t.exitPrice)}</td><td class="r num ${cls(c.net)}"><b>${money(c.net, true)}</b></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }

  return `
  <div class="head"><div><h1>P&L calendar</h1><div class="sub">Daily results by exit date</div></div>
    <div class="actions"><button class="btn" data-act="cal-prev" aria-label="Previous month">‹</button><div class="cal-title">${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div><button class="btn" data-act="cal-next" aria-label="Next month">›</button><button class="btn ghost" data-act="cal-today">Today</button></div></div>
  <div class="grid stats">
    ${statCard(0, 'Month P&L', monthNet, 'smoney', '', cls(monthNet))}
    ${statCard(1, 'Trading days', monthDays, 'int', `${monthWins} green · ${monthDays - monthWins} red`)}
    ${statCard(2, 'Trades', monthTrades, 'int', '')}
  </div>
  <div class="card"><div class="cal">${cells}</div></div>${detail}`;
}

function viewChart() {
  const map = dayMap(), days = Object.keys(map).sort();
  const total = computeStats(state.trades);
  return `
  <div class="head"><div><h1>P&L chart</h1><div class="sub">${days.length} trading day${days.length === 1 ? '' : 's'} · ${money(total.net, true)} total</div></div>
    <div class="actions">
      <div class="seg"><input type="radio" name="cm" id="cm1" value="equity" ${ui.chartMode === 'equity' ? 'checked' : ''}><label for="cm1">Equity curve</label><input type="radio" name="cm" id="cm2" value="daily" ${ui.chartMode === 'daily' ? 'checked' : ''}><label for="cm2">Daily P&L</label></div>
      <div class="seg">${[['all', 'All'], ['90', '90D'], ['30', '30D'], ['7', '7D']].map(([v, l]) => `<input type="radio" name="cr" id="cr${v}" value="${v}" ${ui.chartRange === v ? 'checked' : ''}><label for="cr${v}">${l}</label>`).join('')}</div>
    </div></div>
  <div class="card"><div id="chartHost"></div></div>`;
}

function chartSeries() {
  const map = dayMap();
  let days = Object.keys(map).sort();
  let cum = 0;
  const all = days.map(d => { cum += map[d].net; return { date: d, day: map[d].net, cum, equity: state.startingBalance + cum }; });
  let list = all;
  if (ui.chartRange !== 'all') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(ui.chartRange));
    const ck = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
    list = all.filter(p => p.date >= ck);
  }
  let base = state.startingBalance;
  if (list.length && list.length < all.length) base = all[all.length - list.length - 1].equity;
  return { list, base };
}

function niceStep(range, count) {
  const raw = range / count, pow = 10 ** Math.floor(Math.log10(raw || 1)), f = raw / pow;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
}

function drawChart() {
  const host = $('#chartHost');
  if (!host) return;
  const { list, base } = chartSeries();
  const W = Math.max(480, host.clientWidth), H = 380, M = { l: 74, r: 18, t: 14, b: 34 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const mode = ui.chartMode;
  const need = mode === 'equity' ? 1 : 1;
  if (list.length < need) { host.innerHTML = '<div class="empty">Close some trades to see your chart.</div>'; return; }

  let pts, vals;
  if (mode === 'equity') {
    pts = [{ date: 'Start', v: base, day: 0 }, ...list.map(p => ({ date: p.date, v: p.equity, day: p.day }))];
    vals = pts.map(p => p.v);
  } else {
    pts = list.map(p => ({ date: p.date, v: p.day, day: p.day }));
    vals = pts.map(p => p.v).concat(0);
  }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
  const step = niceStep(hi - lo, 5);
  const t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step;
  const Y = v => M.t + ih - ((v - t0) / (t1 - t0)) * ih;
  const n = pts.length;
  const X = i => M.l + (mode === 'equity' ? (n === 1 ? iw / 2 : (i / (n - 1)) * iw) : (i + 0.5) * (iw / n));

  let g = '';
  for (let v = t0; v <= t1 + step / 2; v += step) {
    g += `<line class="grid-line" x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${M.l - 10}" y="${Y(v) + 4}" text-anchor="end">${money(v).replace(/\.00$/, '')}</text>`;
  }
  const every = Math.max(1, Math.ceil(n / Math.floor(iw / 80)));
  pts.forEach((p, i) => {
    if (i % every === 0) g += `<text x="${X(i)}" y="${H - 10}" text-anchor="middle">${p.date === 'Start' ? 'Start' : dayLabel(p.date)}</text>`;
  });

  let body = '';
  if (mode === 'equity') {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
    const area = `${d} L${X(n - 1).toFixed(1)},${Y(t0)} L${X(0).toFixed(1)},${Y(t0)} Z`;
    body = `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".30"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path class="eq-area" d="${area}" fill="url(#ga)"/>
      ${state.startingBalance >= t0 && state.startingBalance <= t1 ? `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(state.startingBalance)}" y2="${Y(state.startingBalance)}" stroke="var(--muted)" stroke-dasharray="4 4" opacity=".6"/>` : ''}
      <path id="eqline" class="eq-line" d="${d}"/>`;
  } else {
    const bw = Math.max(3, Math.min(46, (iw / n) * 0.68)), y0 = Y(0);
    body = `<line x1="${M.l}" x2="${W - M.r}" y1="${y0}" y2="${y0}" stroke="var(--muted)" opacity=".7"/>` +
      pts.map((p, i) => {
        const yv = Y(p.v), top = Math.min(yv, y0), h = Math.max(1, Math.abs(yv - y0));
        return `<rect class="bar" style="--i:${i};transform-origin:0 ${y0}px" x="${X(i) - bw / 2}" y="${top}" width="${bw}" height="${h}" rx="${Math.min(3, bw / 3)}" fill="${p.v >= 0 ? 'var(--up)' : 'var(--down)'}"/>`;
      }).join('');
  }

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="P&L chart"><g class="axis">${g}</g>${body}
    <line id="hov" y1="${M.t}" y2="${M.t + ih}" stroke="var(--muted)" opacity="0" stroke-dasharray="3 3"/><circle id="hovdot" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    <rect x="${M.l}" y="${M.t}" width="${iw}" height="${ih}" fill="transparent" id="hit"/></svg><div class="chart-tip" id="tip"></div>`;

  const line = $('#eqline');
  if (line) host.style.setProperty('--len', Math.ceil(line.getTotalLength()) + 2);

  const hit = $('#hit'), tip = $('#tip'), hov = $('#hov'), dot = $('#hovdot');
  hit.addEventListener('mousemove', e => {
    const box = host.getBoundingClientRect(), sx = W / box.width;
    const mx = (e.clientX - box.left) * sx;
    let best = 0, bd = Infinity;
    pts.forEach((_, i) => { const d = Math.abs(X(i) - mx); if (d < bd) { bd = d; best = i; } });
    const p = pts[best];
    hov.setAttribute('x1', X(best)); hov.setAttribute('x2', X(best)); hov.setAttribute('opacity', '.8');
    if (mode === 'equity') { dot.setAttribute('cx', X(best)); dot.setAttribute('cy', Y(p.v)); dot.setAttribute('opacity', '1'); }
    tip.innerHTML = mode === 'equity'
      ? `<b>${p.date === 'Start' ? 'Starting balance' : dayLabel(p.date, true)}</b><br>Balance ${money(p.v)}${p.date !== 'Start' ? `<br>Day ${money(p.day, true)}` : ''}`
      : `<b>${dayLabel(p.date, true)}</b><br>${money(p.v, true)}`;
    tip.classList.add('show');
    const tx = X(best) / sx + 14, ty = (mode === 'equity' ? Y(p.v) : Math.min(Y(p.v), Y(0))) / sx - 10;
    tip.style.left = Math.min(tx, box.width - tip.offsetWidth - 4) + 'px';
    tip.style.top = Math.max(0, ty) + 'px';
  });
  hit.addEventListener('mouseleave', () => { tip.classList.remove('show'); hov.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
}

function viewContracts() {
  const rows = state.contracts.map((c, i) => `
    <tr data-sym="${esc(c.symbol)}" style="--i:${Math.min(i, 20)}">
      <td class="sym">${esc(c.symbol)}${c.custom ? ' <span class="pill open">custom</span>' : ''}</td>
      <td><input type="text" data-cf="name" value="${esc(c.name)}" style="width:190px"></td>
      <td><input type="number" step="any" min="0" data-cf="tickSize" value="${c.tickSize}"></td>
      <td><input type="number" step="any" min="0" data-cf="tickValue" value="${c.tickValue}"></td>
      <td class="r num" data-pv>${money(pointValue(c))}</td>
      <td><input type="number" step="0.01" min="0" data-cf="fee" value="${c.fee}"></td>
      <td class="r">${c.custom ? `<button class="btn sm danger" data-act="del-contract" data-sym="${esc(c.symbol)}">Remove</button>` : ''}</td>
    </tr>`).join('');
  return `
  <div class="head"><div><h1>Contracts</h1><div class="sub">Tick size, tick value and fees used for P&L. Edit anything; new trades pick up the changes.</div></div>
    <div class="actions"><button class="btn ghost" data-act="reset-contracts">Restore defaults</button></div></div>
  <div class="card"><div class="tablewrap"><table class="tbl"><thead><tr><th>Symbol</th><th>Name</th><th>Tick size</th><th>Tick value ($)</th><th class="r">Point value</th><th>Fee / contract / side ($)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="card"><h2>Add custom contract</h2>
    <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <label class="f"><span>Symbol</span><input type="text" id="nc-sym" placeholder="e.g. ZB" maxlength="10"></label>
      <label class="f"><span>Name</span><input type="text" id="nc-name" placeholder="30-Year T-Bond"></label>
      <label class="f"><span>Tick size</span><input type="number" step="any" id="nc-tick" placeholder="0.03125"></label>
      <label class="f"><span>Tick value ($)</span><input type="number" step="any" id="nc-tv" placeholder="31.25"></label>
      <label class="f"><span>Fee per side ($)</span><input type="number" step="0.01" id="nc-fee" value="1.25"></label>
    </div>
    <div class="err" id="nc-err"></div>
    <button class="btn primary" data-act="add-contract">Add contract</button></div>`;
}

function themeCard(id, t, kind) {
  const active = state.settings.theme === id;
  return `<button class="theme-card ${active ? 'active' : ''}" data-theme="${id}" id="tc-${id}">
    <div class="sw" style="background:${t.bg}"><div class="chip" style="background:${t.surface}"></div><div class="dots"><i style="background:${t.accent}"></i><i style="background:${t.up}"></i><i style="background:${t.down}"></i><i style="background:${t.text}"></i></div></div>
    <div class="tn">${esc(t.name)}</div><div class="tk">${kind}</div></button>`;
}

function viewSettings() {
  const st = state.settings;
  const customs = ['custom1', 'custom2'].map(id => {
    const t = st.customThemes[id];
    return `<div class="custom" data-slot="${id}">
      <div style="display:flex;gap:10px;align-items:center"><input type="text" data-ct-name="${id}" value="${esc(t.name)}" maxlength="18" style="flex:1"><button class="btn sm ${st.theme === id ? 'primary' : ''}" data-theme="${id}">${st.theme === id ? 'In use' : 'Use'}</button></div>
      <div class="colors">${COLOR_KEYS.map(([k, label]) => `<label>${label}<input type="color" data-ct="${id}:${k}" value="${t[k]}"></label>`).join('')}</div></div>`;
  }).join('');
  return `
  <div class="head"><div><h1>Settings</h1></div></div>
  <div class="card"><h2>Account</h2>
    <div class="setrow"><div>Signed in as <b>${esc(user ? user.username : '')}</b><small>Your journal is saved to this account and available wherever you sign in.</small></div>
      <div class="actions"><button class="btn" data-act="logout">Sign out</button><button class="btn danger" data-act="delete-account">Delete account</button></div></div>
    <div class="setrow"><div>Starting balance<small>Your balance chart and account total build from this number.</small></div>
      <div class="actions"><b class="num">${money(state.startingBalance)}</b><button class="btn" data-act="balance">Edit</button></div></div></div>
  <div class="card"><h2>Interface style</h2>
    <div class="styles">${Object.entries(STYLES).map(([id, s]) => `<button class="style-card ${st.style === id ? 'active' : ''}" data-pick-style="${id}"><b>${s.name}</b><span>${s.desc}</span></button>`).join('')}</div></div>
  <div class="card"><h2>Color theme</h2>
    <div class="themes">
      ${['daylight', 'latte'].map(id => themeCard(id, THEMES[id], 'Light')).join('')}
      ${['midnight', 'obsidian'].map(id => themeCard(id, THEMES[id], 'Dark')).join('')}
      ${['custom1', 'custom2'].map(id => themeCard(id, st.customThemes[id], 'Custom slot')).join('')}
    </div>
    <div class="custom-grid">${customs}</div></div>
  <div class="card"><h2>Behavior</h2>
    <div class="setrow"><div>Loading screen<small>Show a random 0.5 to 2.5 second splash with a trading tip or one of your stats.</small></div>
      <label class="switch"><input type="checkbox" data-set="loading" ${st.loading ? 'checked' : ''}><i></i></label></div>
    <div class="setrow"><div>Animations<small>Turn off for instant transitions.</small></div>
      <label class="switch"><input type="checkbox" data-set="animations" ${st.animations ? 'checked' : ''}><i></i></label></div></div>
  <div class="card"><h2>Data</h2>
    <div class="actions"><button class="btn" data-act="export">Export backup (JSON)</button><button class="btn" data-act="import">Import backup</button><button class="btn danger" data-act="reset-all">Erase all data</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="mut" style="margin-top:10px">Your journal is stored in your account. Backups are a good idea before erasing or importing.</p></div>`;
}

/* =====================================================
   Rendering
   ===================================================== */
const RENDER = { overview: viewOverview, trades: viewTrades, calendar: viewCalendar, chart: viewChart, contracts: viewContracts, settings: viewSettings };

function render(opts = {}) {
  const v = $('#view');
  v.innerHTML = RENDER[ui.view]();
  if (opts.enter !== false) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  if (opts.scrollTop) $('#main').scrollTop = 0;
  renderNav();
  animateNumbers(v);
  if (ui.view === 'chart') drawChart();
}
function go(view) {
  if (view === ui.view) return;
  ui.view = view; state.settings.lastView = view; save();
  render({ scrollTop: true });
}

function animateNumbers(root) {
  const els = $$('[data-count]', root);
  if (!state.settings.animations) return;
  const t0 = performance.now(), dur = 800;
  const items = els.map(el => ({ el, to: parseFloat(el.dataset.count), fmt: el.dataset.fmt })).filter(i => isFinite(i.to));
  if (!items.length) return;
  (function tick(now) {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    items.forEach(i => { i.el.textContent = fmtVal(i.to * e, i.fmt); });
    if (p < 1) requestAnimationFrame(tick);
    else items.forEach(i => { i.el.textContent = fmtVal(i.to, i.fmt); });
  })(t0);
}

/* =====================================================
   Modal, confirm, toast
   ===================================================== */
let modalOpen = false, modalResolve = null;
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="scrim" data-act="modal-close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  m.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
  modalOpen = true;
  setTimeout(() => { const f = $('.sheet input:not([type=radio]), .sheet select, .sheet button.primary', m); if (f) f.focus(); }, 80);
}
function closeModal() {
  if (!modalOpen) return;
  const m = $('#modal');
  m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); modalOpen = false;
  if (modalResolve) { modalResolve(false); modalResolve = null; }
  setTimeout(() => { if (!modalOpen) m.innerHTML = ''; }, 320);
}
function confirmDialog(title, text, okLabel = 'Delete') {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2><p class="mut">${esc(text)}</p><div class="modal-actions"><button class="btn" data-act="modal-close">Cancel</button><button class="btn primary" data-act="modal-ok">${esc(okLabel)}</button></div>`);
    modalResolve = res;
  });
}
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2400);
}

/* =====================================================
   Trade form
   ===================================================== */
function contractOptions(t) {
  const opts = state.contracts.slice();
  if (t && !opts.find(c => c.symbol === t.symbol)) opts.push({ symbol: t.symbol, name: '(removed contract)', tickSize: t.tick, tickValue: t.pv * t.tick, fee: t.fee });
  return opts;
}

function openTradeModal(id, mode) {
  const t = id ? state.trades.find(x => x.id === id) : null;
  const opts = contractOptions(t);
  const sym = t ? t.symbol : (getContract(state.settings.lastSymbol) ? state.settings.lastSymbol : opts[0].symbol);
  const c = opts.find(o => o.symbol === sym) || opts[0];
  const closed = t ? !isOpen(t) : mode === 'closed';
  const side = t ? t.side : 'long';
  const v = {
    qty: t ? t.qty : 1, entryPrice: t ? priceStr(t.entryPrice) : '', entryTime: t ? t.entryTime : nowLocal(),
    exitPrice: t && t.exitPrice != null ? priceStr(t.exitPrice) : '', exitTime: t && t.exitTime ? t.exitTime : nowLocal(),
    fee: t ? t.fee : c.fee, notes: t ? (t.notes || '') : ''
  };
  openModal(`
  <form id="tf" data-id="${t ? t.id : ''}" autocomplete="off" novalidate>
    <h2>${t ? 'Edit trade' : 'New trade'}</h2>
    <div class="form-grid">
      <div class="full"><div class="seg"><input type="radio" name="mode" id="md-o" value="open" ${closed ? '' : 'checked'}><label for="md-o">Open position</label><input type="radio" name="mode" id="md-c" value="closed" ${closed ? 'checked' : ''}><label for="md-c">Completed trade</label></div></div>
      <label class="f"><span>Contract</span><select name="symbol">${opts.map(o => `<option value="${esc(o.symbol)}" ${o.symbol === sym ? 'selected' : ''}>${esc(o.symbol)} · ${esc(o.name)}</option>`).join('')}</select></label>
      <div class="f"><span style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Side</span><div class="seg"><input type="radio" class="long" name="side" id="sd-l" value="long" ${side === 'long' ? 'checked' : ''}><label for="sd-l">Long</label><input type="radio" class="short" name="side" id="sd-s" value="short" ${side === 'short' ? 'checked' : ''}><label for="sd-s">Short</label></div></div>
      <label class="f"><span>Contracts</span><input type="number" name="qty" min="1" step="1" value="${v.qty}"></label>
      <label class="f"><span>Fee per contract, per side ($)</span><input type="number" name="fee" min="0" step="0.01" value="${v.fee}"></label>
      <label class="f"><span>Entry price</span><input type="number" name="entryPrice" step="any" value="${v.entryPrice}"></label>
      <label class="f"><span>Entry time</span><input type="datetime-local" name="entryTime" value="${v.entryTime}"></label>
      <div class="collapse ${closed ? 'show' : ''}" id="exitBox" ${closed ? '' : 'inert'}><div><div class="form-grid">
        <label class="f"><span>Exit price</span><input type="number" name="exitPrice" step="any" value="${v.exitPrice}"></label>
        <label class="f"><span>Exit time</span><input type="datetime-local" name="exitTime" value="${v.exitTime}"></label>
      </div></div></div>
      <label class="f full"><span>Notes (setup, mistakes, how you felt)</span><textarea name="notes">${esc(v.notes)}</textarea></label>
      <div class="full preview" id="pv"></div>
      <div class="full err" id="ferr"></div>
    </div>
    <div class="modal-actions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button type="submit" class="btn primary">${t ? 'Save changes' : 'Save trade'}</button></div>
  </form>`);
  const f = $('#tf');
  f.dataset.feeTouched = t ? '1' : '';
  updateTradePreview();
}

function readTradeForm() {
  const f = $('#tf'), fd = new FormData(f);
  const closed = fd.get('mode') === 'closed';
  const sym = fd.get('symbol');
  const out = {
    closed, symbol: sym, side: fd.get('side'),
    qty: parseInt(fd.get('qty'), 10), fee: parseFloat(fd.get('fee')),
    entryPrice: parseFloat(fd.get('entryPrice')), entryTime: fd.get('entryTime'),
    exitPrice: closed ? parseFloat(fd.get('exitPrice')) : null, exitTime: closed ? fd.get('exitTime') : null,
    notes: (fd.get('notes') || '').trim()
  };
  return out;
}
function formContract(sym) {
  const id = $('#tf').dataset.id;
  const t = id ? state.trades.find(x => x.id === id) : null;
  return contractOptions(t).find(c => c.symbol === sym);
}
function updateTradePreview() {
  const f = $('#tf'); if (!f) return;
  const d = readTradeForm(), c = formContract(d.symbol), box = $('#pv');
  if (!c) return;
  const pv = pointValue(c);
  if (!d.closed) {
    box.innerHTML = `<span class="mut">Saved as an open position. 1 point = ${money(pv * (d.qty || 0))}, tick = ${money(c.tickValue * (d.qty || 0))}. Close it later from the Overview.</span>`;
    return;
  }
  if (![d.entryPrice, d.exitPrice, d.qty, d.fee].every(Number.isFinite)) { box.innerHTML = '<span class="mut">Enter prices to see the P&L.</span>'; return; }
  const r = calc({ side: d.side, entryPrice: d.entryPrice, exitPrice: d.exitPrice, pv, qty: d.qty, fee: d.fee, tick: c.tickSize });
  box.innerHTML = `Net <b class="${cls(r.net)} num">${money(r.net, true)}</b> <span class="mut num">· gross ${money(r.gross, true)} · fees ${money(r.fees)} · ${r.ticks >= 0 ? '+' : ''}${round(r.ticks, 1)} ticks</span>`;
}

function submitTrade() {
  const d = readTradeForm(), err = $('#ferr');
  const fail = msg => { err.textContent = msg; };
  const c = formContract(d.symbol);
  if (!c) return fail('Pick a contract.');
  if (!(d.qty >= 1)) return fail('Contracts must be 1 or more.');
  if (!Number.isFinite(d.fee) || d.fee < 0) return fail('Enter a fee of 0 or more.');
  if (!Number.isFinite(d.entryPrice)) return fail('Enter an entry price.');
  if (!d.entryTime) return fail('Enter an entry time.');
  if (d.closed) {
    if (!Number.isFinite(d.exitPrice)) return fail('Enter an exit price, or switch to Open position.');
    if (!d.exitTime) return fail('Enter an exit time.');
    if (d.exitTime < d.entryTime) return fail('Exit time is before entry time.');
  }
  const id = $('#tf').dataset.id;
  const existing = id ? state.trades.find(x => x.id === id) : null;
  const sameSymbol = existing && existing.symbol === d.symbol;
  const trade = {
    id: existing ? existing.id : uid(), symbol: d.symbol, side: d.side, qty: d.qty,
    entryPrice: d.entryPrice, entryTime: d.entryTime, exitPrice: d.exitPrice, exitTime: d.exitTime,
    fee: d.fee, tick: sameSymbol ? existing.tick : c.tickSize, pv: sameSymbol ? existing.pv : pointValue(c), notes: d.notes
  };
  if (existing) Object.assign(existing, trade); else state.trades.push(trade);
  state.settings.lastSymbol = d.symbol;
  save(); closeModal(); render({ enter: false });
  toast(existing ? 'Trade updated' : d.closed ? 'Trade added' : 'Position opened');
}

function openCloseModal(id) {
  const t = state.trades.find(x => x.id === id); if (!t) return;
  openModal(`
  <form id="cf" data-id="${t.id}" autocomplete="off" novalidate>
    <h2>Close ${esc(t.symbol)} ${t.side}</h2>
    <p class="mut" style="margin-bottom:12px">${t.qty} contract${t.qty > 1 ? 's' : ''} from ${priceStr(t.entryPrice)}, entered ${fmtDateTime(t.entryTime)}</p>
    <div class="form-grid">
      <label class="f"><span>Exit price</span><input type="number" name="exitPrice" step="any"></label>
      <label class="f"><span>Exit time</span><input type="datetime-local" name="exitTime" value="${nowLocal()}"></label>
      <div class="full preview" id="cpv"><span class="mut">Enter an exit price to see the P&L.</span></div>
      <div class="full err" id="cerr"></div>
    </div>
    <div class="modal-actions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button type="submit" class="btn primary">Close position</button></div>
  </form>`);
}
function closePreview() {
  const f = $('#cf'); if (!f) return;
  const t = state.trades.find(x => x.id === f.dataset.id), ep = parseFloat(new FormData(f).get('exitPrice'));
  if (!Number.isFinite(ep)) { $('#cpv').innerHTML = '<span class="mut">Enter an exit price to see the P&L.</span>'; return; }
  const r = calc({ ...t, exitPrice: ep });
  $('#cpv').innerHTML = `Net <b class="${cls(r.net)} num">${money(r.net, true)}</b> <span class="mut num">· gross ${money(r.gross, true)} · fees ${money(r.fees)} · ${r.ticks >= 0 ? '+' : ''}${round(r.ticks, 1)} ticks</span>`;
}
function submitClose() {
  const f = $('#cf'), fd = new FormData(f), t = state.trades.find(x => x.id === f.dataset.id);
  const ep = parseFloat(fd.get('exitPrice')), et = fd.get('exitTime');
  if (!Number.isFinite(ep)) return ($('#cerr').textContent = 'Enter an exit price.');
  if (!et) return ($('#cerr').textContent = 'Enter an exit time.');
  if (et < t.entryTime) return ($('#cerr').textContent = 'Exit time is before entry time.');
  t.exitPrice = ep; t.exitTime = et; save(); closeModal(); render({ enter: false });
  const r = calc(t); toast(`Closed ${t.symbol}: ${money(r.net, true)}`);
}

function openBalanceModal() {
  openModal(`
  <form id="bf" autocomplete="off" novalidate><h2>Starting balance</h2>
    <label class="f"><span>Account starting balance ($)</span><input type="number" name="bal" step="0.01" value="${state.startingBalance}"></label>
    <div class="err" id="berr"></div>
    <div class="modal-actions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`);
}

async function deleteTrade(id) {
  const t = state.trades.find(x => x.id === id); if (!t) return;
  const ok = await confirmDialog('Delete this trade?', `${t.symbol} ${t.side} · ${t.qty} contract${t.qty > 1 ? 's' : ''}. This can't be undone.`);
  if (!ok) return;
  state.trades = state.trades.filter(x => x.id !== id); save();
  const row = document.querySelector(`[data-row="${id}"]`);
  if (row && state.settings.animations) { row.classList.add('leaving'); setTimeout(() => render({ enter: false }), 260); } else render({ enter: false });
  toast('Trade deleted');
}

/* =====================================================
   Events
   ===================================================== */
document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { go(nav.dataset.nav); return; }

  const th = e.target.closest('[data-theme]');
  if (th) { state.settings.theme = th.dataset.theme; save(); applyTheme(true); if (ui.view === 'settings') render({ enter: false }); return; }
  const sty = e.target.closest('[data-pick-style]');
  if (sty) { state.settings.style = sty.dataset.pickStyle; save(); applyStyle(); if (ui.view === 'settings') render({ enter: false }); if (ui.view === 'chart') drawChart(); return; }

  const day = e.target.closest('[data-day]');
  if (day) { ui.selDay = ui.selDay === day.dataset.day ? null : day.dataset.day; render({ enter: false }); return; }

  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  switch (act) {
    case 'new': case 'new-closed': openTradeModal(null, 'closed'); break;
    case 'new-open': openTradeModal(null, 'open'); break;
    case 'edit': openTradeModal(id); break;
    case 'close': openCloseModal(id); break;
    case 'del': deleteTrade(id); break;
    case 'balance': openBalanceModal(); break;
    case 'modal-close': closeModal(); break;
    case 'modal-ok': if (modalResolve) { const r = modalResolve; modalResolve = null; closeModal(); r(true); } break;
    case 'cal-prev': ui.cal.m--; if (ui.cal.m < 0) { ui.cal.m = 11; ui.cal.y--; } ui.selDay = null; render(); break;
    case 'cal-next': ui.cal.m++; if (ui.cal.m > 11) { ui.cal.m = 0; ui.cal.y++; } ui.selDay = null; render(); break;
    case 'cal-today': ui.cal = { y: new Date().getFullYear(), m: new Date().getMonth() }; ui.selDay = null; render(); break;
    case 'add-contract': addContract(); break;
    case 'del-contract': {
      const sym = a.dataset.sym;
      if (await confirmDialog('Remove contract?', `${sym} will be removed from the list. Existing trades keep their values.`, 'Remove')) {
        state.contracts = state.contracts.filter(c => c.symbol !== sym); save(); render({ enter: false });
      }
      break;
    }
    case 'reset-contracts':
      if (await confirmDialog('Restore default contracts?', 'Default contracts return to their original values. Your custom contracts are kept.', 'Restore')) {
        const customs = state.contracts.filter(c => c.custom);
        state.contracts = [...DEFAULT_CONTRACTS.map(c => ({ ...c })), ...customs]; save(); render({ enter: false });
      }
      break;
    case 'logout': logout(); break;
    case 'delete-account': openDeleteModal(); break;
    case 'export': exportData(); break;
    case 'import': $('#importFile').click(); break;
    case 'reset-all':
      if (await confirmDialog('Erase all data?', 'This deletes every trade, contract change, and setting on this Mac. Export a backup first if you want to keep it.', 'Erase everything')) {
        state = defaultState(); save(); applyTheme(true); applyStyle(); applyAnim(); ui.view = 'overview'; render(); toast('All data erased');
      }
      break;
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'af') submitAuth();
  else if (e.target.id === 'df') submitDelete();
  else if (e.target.id === 'tf') submitTrade();
  else if (e.target.id === 'cf') submitClose();
  else if (e.target.id === 'bf') {
    const v = parseFloat(new FormData(e.target).get('bal'));
    if (!Number.isFinite(v)) { $('#berr').textContent = 'Enter a number.'; return; }
    state.startingBalance = v; save(); closeModal(); render({ enter: false }); toast('Starting balance updated');
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.name === 'authmode') { setAuthMode(t.value); return; }
  if (t.closest('#tf')) {
    if (t.name === 'fee') $('#tf').dataset.feeTouched = '1';
    if (t.name === 'mode') {
      const closed = t.value === 'closed', box = $('#exitBox');
      box.classList.toggle('show', closed); closed ? box.removeAttribute('inert') : box.setAttribute('inert', '');
    }
    if (t.name === 'symbol') {
      const c = formContract(t.value);
      if (c && !$('#tf').dataset.feeTouched) $('#tf [name=fee]').value = c.fee;
    }
    updateTradePreview();
  } else if (t.closest('#cf')) closePreview();
  else if (t.id === 'fq') { ui.filter.q = t.value; refreshTradesBody(); }
  else if (t.dataset.ct) {
    const [slot, key] = t.dataset.ct.split(':');
    state.settings.customThemes[slot][key] = t.value; save();
    if (state.settings.theme === slot) applyTheme();
    const card = $(`#tc-${slot} .sw`);
    if (card) {
      const th = state.settings.customThemes[slot];
      card.style.background = th.bg; card.firstElementChild.style.background = th.surface;
      $$('.dots i', card).forEach((el, i) => el.style.background = [th.accent, th.up, th.down, th.text][i]);
    }
  } else if (t.dataset.ctName) {
    const slot = t.dataset.ctName; state.settings.customThemes[slot].name = t.value || 'Custom'; save();
    const n = $(`#tc-${slot} .tn`); if (n) n.textContent = t.value || 'Custom';
  }
});

function refreshTradesBody() {
  // re-render only the table area so the search box keeps focus
  const pos = document.activeElement && document.activeElement.selectionStart;
  render({ enter: false });
  const q = $('#fq'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fside') { ui.filter.side = t.value; render({ enter: false }); }
  else if (t.id === 'fres') { ui.filter.result = t.value; render({ enter: false }); }
  else if (t.name === 'cm') { ui.chartMode = t.value; drawChart(); }
  else if (t.name === 'cr') { ui.chartRange = t.value; drawChart(); }
  else if (t.dataset.set) {
    state.settings[t.dataset.set] = t.checked; save(); applyAnim();
    toast(`${t.dataset.set === 'loading' ? 'Loading screen' : 'Animations'} ${t.checked ? 'on' : 'off'}`);
  } else if (t.dataset.cf) {
    const row = t.closest('tr'), c = getContract(row.dataset.sym); if (!c) return;
    const k = t.dataset.cf;
    if (k === 'name') c.name = t.value.trim() || c.symbol;
    else {
      const n = parseFloat(t.value);
      if (!(n >= 0) || ((k === 'tickSize' || k === 'tickValue') && n === 0)) { t.value = c[k]; return; }
      c[k] = n;
    }
    save();
    const pv = $('[data-pv]', row); if (pv) pv.textContent = money(pointValue(c));
  } else if (t.id === 'importFile') importData(t.files[0]);
});

function addContract() {
  const sym = $('#nc-sym').value.trim().toUpperCase(), name = $('#nc-name').value.trim() || sym;
  const tick = parseFloat($('#nc-tick').value), tv = parseFloat($('#nc-tv').value), fee = parseFloat($('#nc-fee').value);
  const err = $('#nc-err');
  if (!sym) return (err.textContent = 'Enter a symbol.');
  if (getContract(sym)) return (err.textContent = `${sym} is already in the list.`);
  if (!(tick > 0)) return (err.textContent = 'Tick size must be greater than 0.');
  if (!(tv > 0)) return (err.textContent = 'Tick value must be greater than 0.');
  state.contracts.push({ symbol: sym, name, tickSize: tick, tickValue: tv, fee: Number.isFinite(fee) ? fee : 0, custom: true });
  save(); render({ enter: false }); toast(`${sym} added`);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `trade-journal-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup exported');
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const s = JSON.parse(r.result);
      if (!Array.isArray(s.trades)) throw new Error('bad');
      if (await confirmDialog('Replace your data?', `This backup has ${s.trades.length} trades. It will replace everything currently stored.`, 'Import')) {
        state = normalize(s); save(); applyTheme(true); applyStyle(); applyAnim(); render(); toast('Backup imported');
      }
    } catch (err) { toast('That file is not a valid backup'); }
    $('#importFile').value = '';
  };
  r.readAsText(file);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen) closeModal();
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (user && !typing && !modalOpen && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openTradeModal(null, 'closed'); }
});
window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(() => { if (ui.view === 'chart') drawChart(); }, 120); });
setInterval(() => $$('[data-since]').forEach(el => { el.textContent = fmtDur(Date.now() - parseLocal(el.dataset.since)); }), 30000);

/* =====================================================
   Loading screen
   ===================================================== */
function loaderLine() {
  const s = computeStats(state.trades), lines = [];
  if (s.n > 0) {
    lines.push(`Win rate: ${s.winRate.toFixed(1)}% across ${s.n} closed trade${s.n > 1 ? 's' : ''}.`);
    lines.push(`All-time net P&L: ${money(s.net, true)}.`);
    if (s.w && s.l) lines.push(`Average winner ${money(s.avgW)} vs average loser ${money(s.avgL)}.`);
    if (s.best) lines.push(`Your best trade so far: ${money(s.best.net, true)} on ${s.best.t.symbol}.`);
    if (s.fees) lines.push(`You have paid ${money(s.fees)} in fees. Worth watching.`);
    const dm = dayMap(), days = Object.keys(dm);
    if (days.length) {
      const bd = days.reduce((a, b) => dm[a].net >= dm[b].net ? a : b);
      lines.push(`Best day: ${dayLabel(bd, true)} at ${money(dm[bd].net, true)}.`);
      lines.push(`Green days: ${days.filter(d => dm[d].net > 0).length} of ${days.length}.`);
    }
    const counts = {}; closedTrades().forEach(t => counts[t.symbol] = (counts[t.symbol] || 0) + 1);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) lines.push(`Most traded contract: ${top[0]} (${top[1]} trades).`);
  }
  if (openTrades().length) lines.push(`You have ${openTrades().length} open position${openTrades().length > 1 ? 's' : ''}.`);
  if (lines.length && Math.random() < 0.55) return { kind: 'Your stats', text: lines[Math.floor(Math.random() * lines.length)] };
  return { kind: 'Trading tip', text: TIPS[Math.floor(Math.random() * TIPS.length)] };
}
function runLoader() {
  const el = $('#loader');
  if (!state.settings.loading) return;
  const l = loaderLine();
  $('#loaderKind').textContent = l.kind; $('#loaderTip').textContent = l.text;
  const ms = Math.round(500 + Math.random() * 2000), fill = $('#loaderFill');
  fill.style.transition = 'none'; fill.style.width = '0';
  el.style.transition = 'none'; el.classList.remove('hide'); void el.offsetWidth; el.style.transition = '';
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transition = `width ${ms}ms linear`; fill.style.width = '100%'; }));
  setTimeout(() => el.classList.add('hide'), ms);
}

/* =====================================================
   Boot
   ===================================================== */
const MARK = '<svg viewBox="0 0 48 48" width="52" height="52"><path d="M6 34 L17 22 L26 29 L42 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

async function api(path, body) {
  const r = await fetch('/api/' + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

function showAuth(mode = 'login') {
  const a = $('#auth');
  document.body.classList.remove('in');
  a.innerHTML = `<form id="af" class="auth-card" data-mode="${mode}" novalidate>
    <div class="mark">${MARK}</div>
    <h1>Trade Journal</h1>
    <p class="mut" id="atag"></p>
    <div class="seg"><input type="radio" name="authmode" id="am-l" value="login" ${mode === 'login' ? 'checked' : ''}><label for="am-l">Sign in</label><input type="radio" name="authmode" id="am-r" value="register" ${mode === 'register' ? 'checked' : ''}><label for="am-r">Create account</label></div>
    <label class="f"><span>Username</span><input type="text" name="username" autocomplete="username" maxlength="24" autocapitalize="off" spellcheck="false"></label>
    <label class="f"><span>Password</span><input type="password" name="password" maxlength="200"></label>
    <p class="mut" id="ahint" style="font-size:12px"></p>
    <div class="err" id="aerr"></div>
    <button class="btn primary" type="submit" id="asubmit"></button>
  </form>`;
  setAuthMode(mode);
  a.classList.remove('hide');
  setTimeout(() => { const u = $('#af [name=username]'); if (u) u.focus(); }, 60);
}
function setAuthMode(mode) {
  const f = $('#af'); if (!f) return;
  f.dataset.mode = mode;
  const reg = mode === 'register';
  $('#asubmit').textContent = reg ? 'Create account' : 'Sign in';
  $('#atag').textContent = reg ? 'Create an account to save your journal online.' : 'Sign in to open your journal.';
  $('#ahint').textContent = reg ? 'Usernames are 3 to 24 letters, numbers, dots, dashes or underscores. Passwords need 8+ characters. Only one account can be created per network (IP address).' : '';
  $('#af [name=password]').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
  $('#aerr').textContent = '';
}
async function submitAuth() {
  const f = $('#af'), fd = new FormData(f), mode = f.dataset.mode, err = $('#aerr'), btn = $('#asubmit');
  const username = (fd.get('username') || '').trim(), password = fd.get('password') || '';
  if (!username || !password) { err.textContent = 'Enter a username and password.'; return; }
  btn.disabled = true; err.textContent = '';
  try {
    const r = await api(mode === 'register' ? 'register' : 'login', { username, password });
    if (!r.ok) { err.textContent = r.data.error || 'Something went wrong.'; btn.disabled = false; return; }
    await enterApp(r.data.username);
  } catch (e) { err.textContent = 'Could not reach the server.'; btn.disabled = false; }
}

async function enterApp(username) {
  const r = await api('data');
  if (r.status === 401) { showAuth('login'); return; }
  if (!r.ok) { toast(r.data.error || 'Could not load your journal'); showAuth('login'); return; }
  user = { username };
  const fresh = !r.data.state;
  state = fresh ? normalize({ settings: loadPrefs() }) : normalize(r.data.state);
  ui.view = state.settings.lastView || 'overview';
  ui.selDay = null;
  applyTheme(false); applyStyle(); applyAnim();
  failing = false; setSync(fresh ? '' : 'Saved');
  if (fresh) save();
  $('#auth').classList.add('hide');
  document.body.classList.add('in');
  render({ scrollTop: true });
  runLoader();
}

function resetToSignedOut() {
  user = null; dirty = false; clearTimeout(saveTimer);
  state = normalize({ settings: loadPrefs() });
  applyTheme(false); applyStyle(); applyAnim();
  closeModal();
  showAuth('login');
}
function sessionExpired() { resetToSignedOut(); toast('Your session expired. Please sign in again.'); }
async function logout() {
  await flush();
  try { await api('logout', {}); } catch (e) { /* ignore */ }
  resetToSignedOut();
}
function openDeleteModal() {
  openModal(`<form id="df" novalidate autocomplete="off"><h2>Delete your account?</h2>
    <p class="mut" style="margin-bottom:12px">This permanently deletes your account and every trade in it. Export a backup first if you want to keep your data.</p>
    <label class="f"><span>Enter your password to confirm</span><input type="password" name="pw"></label>
    <div class="err" id="derr"></div>
    <div class="modal-actions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button type="submit" class="btn primary">Delete account</button></div></form>`);
}
async function submitDelete() {
  const pw = new FormData($('#df')).get('pw');
  if (!pw) { $('#derr').textContent = 'Enter your password.'; return; }
  const r = await api('account', { password: pw });
  if (!r.ok) { $('#derr').textContent = r.data.error || 'Could not delete the account.'; return; }
  resetToSignedOut(); toast('Account deleted');
}

async function boot() {
  applyTheme(false); applyStyle(); applyAnim();
  try {
    const r = await api('me');
    if (r.ok) { await enterApp(r.data.username); return; }
  } catch (e) { /* offline: fall through to sign-in */ }
  showAuth('login');
}
boot();

})();
