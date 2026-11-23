// Token Launch Radar dashboard: renders the board from window.TOKEN_RADAR
// (written by main.ts as data.js), with sorting, filtering and a detail view.
// No network: all data is local.

const data = window.TOKEN_RADAR;
const rows = data.rows;

const $ = (id) => document.getElementById(id);
const tbody = $('rows');

function fmtUsd(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n;
}

function fmtChange(c) {
  if (c === null || c === undefined) return '<span>—</span>';
  const cls = c >= 0 ? 'up' : 'down';
  return '<span class="' + cls + '">' + (c >= 0 ? '+' : '') + c.toFixed(1) + '%</span>';
}

function fmtAge(days) {
  if (days === null || days === undefined) return '—';
  if (days < 365) return Math.round(days / 30.4) + ' mo';
  return (days / 365.25).toFixed(1) + ' yr';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- header / model -------------------------------------------------------
$('asOf').textContent = data.as_of;
$('floor').textContent = fmtUsd(data.floor_usd);
$('count').textContent = rows.length;
$('modelText').textContent = data.model;
const wlCount = rows.filter((r) => r.watchlist).length;
$('legend').innerHTML =
  '<span><b>' + rows.length + '</b>ranked</span>' +
  '<span><b>' + wlCount + '</b>watchlist</span>' +
  '<span><b>' + fmtUsd(rows[0].implied_value_usd) + '</b>top value</span>';

// ---- filter controls ------------------------------------------------------
const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
for (const c of cats) {
  const o = document.createElement('option');
  o.value = c;
  o.textContent = c;
  $('cat').appendChild(o);
}
const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
for (const c of chains) {
  const o = document.createElement('option');
  o.value = c;
  o.textContent = c;
  $('chain').appendChild(o);
}

// ---- sorting + filtering --------------------------------------------------
let sortKey = 'rank';
let sortAsc = true;

function sortValue(r, key) {
  if (key === 'age_days') return r.age_days === null ? -1 : r.age_days;
  if (key === 'change_7d') return r.change_7d === null ? -Infinity : r.change_7d;
  if (key === 'category') return r.category || '';
  return r[key];
}

function filtered() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const chain = $('chain').value;
  const wl = $('watchOnly').checked;
  let out = rows.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    if (cat && r.category !== cat) return false;
    if (chain && !r.chains.includes(chain)) return false;
    if (wl && !r.watchlist) return false;
    return true;
  });
  const dir = sortAsc ? 1 : -1;
  out.sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.rank - b.rank;
  });
  return out;
}

let selected = null;

function render() {
  const list = filtered();
  $('showing').textContent = list.length + ' of ' + rows.length + ' shown';
  $('empty').hidden = list.length > 0;
  tbody.innerHTML = list
    .map(
      (r) =>
        '<tr data-slug="' + esc(r.slug) + '" class="' + (selected === r.slug ? 'sel' : '') + '">' +
        '<td class="num">' + r.rank + (r.watchlist ? ' <span class="wl" title="On the watchlist">●</span>' : '') + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong><br><span class="cat">' + esc(r.slug) + '</span></td>' +
        '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtChange(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td><span class="cat">' + esc(r.category || '—') + '</span></td>' +
        '<td><span class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</span></td>' +
        '</tr>',
    )
    .join('');
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === sortKey);
    th.classList.toggle('asc', th.dataset.sort === sortKey && sortAsc);
  });
}

function showDetail(slug) {
  const r = rows.find((x) => x.slug === slug);
  if (!r) return;
  selected = slug;
  const formula =
    fmtUsd(r.tvl_usd) + ' TVL × ' + r.value_multiple.toFixed(2) + ' (' + (r.category || 'no category') + ')' +
    ' × ' + r.growth_factor.toFixed(2) + ' (7d ' + (r.change_7d === null ? 'n/a' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + ')' +
    ' × ' + r.age_factor.toFixed(2) + ' (' + fmtAge(r.age_days) + ' listed)' +
    ' × ' + r.chain_factor.toFixed(2) + ' (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')' +
    ' = ' + fmtUsd(r.implied_value_usd);
  $('detail').innerHTML =
    (r.watchlist ? '<span class="badge">WATCHLIST · TVL ≥ ' + fmtUsd(data.floor_usd) + '</span>' : '') +
    '<h2>' + esc(r.name) + '</h2>' +
    '<p class="slug">' + esc(r.slug) + ' · ' + esc(r.category || 'No category') + '</p>' +
    '<p class="big">' + fmtUsd(r.implied_value_usd) + '</p>' +
    '<p class="bigLab">Implied launch value · rank #' + r.rank + '</p>' +
    '<dl class="kv">' +
    '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
    '<dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(2) + '%') + '</dd>' +
    '<dt>Listed since</dt><dd>' + (r.listed_at || '—') + ' (' + fmtAge(r.age_days) + ')</dd>' +
    '<dt>Chains</dt><dd>' + esc(r.chains.join(', ')) + '</dd>' +
    '<dt>Token recorded</dt><dd>No — records no token</dd>' +
    '</dl>' +
    '<h3>How the value is built</h3>' +
    '<p class="formula">' + esc(formula) + '</p>' +
    '<h3>Farm plan</h3>' +
    '<ol>' + r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
  render();
}

tbody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (tr) showDetail(tr.dataset.slug);
});

document.querySelectorAll('th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortKey === key) sortAsc = !sortAsc;
    else {
      sortKey = key;
      sortAsc = key === 'name' || key === 'category';
    }
    render();
  });
});

['q', 'cat', 'chain', 'watchOnly'].forEach((id) => {
  $(id).addEventListener(id === 'q' ? 'input' : 'change', render);
});

render();
showDetail(rows[0].slug);
