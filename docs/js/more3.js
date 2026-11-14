(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

/* ---------- journal: private, longer writing about each day ---------- */
// Separate from the day page Notes (those are quick plan notes and reminders).
PT.views.journal = function (parts) {
  const date = parts[1] || PT.today(), j = PT.state.journal;
  const words = h('span', { class: 'small muted' });
  const count = () => { const n = (j[date] || '').trim().split(/\s+/).filter(Boolean).length; words.textContent = n ? n + (n === 1 ? ' word · saved' : ' words · saved') : ''; };
  const area = h('textarea', { class: 'journal-text', placeholder: 'How did today really go? How you felt, sleep, energy, what went well, what to work on, anything on your mind…', value: j[date] || '' });
  area.addEventListener('input', () => { if (area.value.trim()) j[date] = area.value; else delete j[date]; PT.save(); count(); });
  count();
  const past = Object.keys(j).filter(d => d !== date && (j[d] || '').trim()).sort().reverse();
  return h('div', {},
    h('h1', {}, 'Journal'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/journal/' + PT.addDays(date, -1); } }, '‹'),
      h('div', { class: 'week-title' }, date === PT.today() ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)),
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/journal/' + PT.addDays(date, 1); } }, '›')),
    area, h('div', { class: 'row between', style: { marginTop: '6px' } }, words, date !== PT.today() ? h('a', { class: 'small red', href: '#/journal' }, 'Back to today') : h('span')),
    h('h2', {}, past.length ? 'Past entries' : 'Past entries · none yet'),
    past.slice(0, 60).map(d => h('a', { class: 'card tap', href: '#/journal/' + d },
      h('div', { class: 'row between' }, h('b', {}, PT.niceDate(d)), h('span', { class: 'red' }, '›')),
      h('div', { class: 'small muted' }, j[d].length > 110 ? j[d].slice(0, 110).trim() + '…' : j[d]))));
};

/* ---------- your code (motivation: only what you write) ---------- */
PT.moreViews.code = function () {
  const s = PT.state, q = PT.todayQuote(), nq = { text: '', by: '' };
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Your code'),
    h('p', { class: 'muted small' }, 'Your own words, not generic motivation. A quote from your list shows at the top of the Plan tab each day.'),
    q ? h('div', { class: 'quote' }, '“' + q.text + '”', q.by ? h('small', {}, q.by) : null) : null,
    h('h2', {}, 'How I live (principles)'),
    h('textarea', { placeholder: 'Your standards, your why, the rules you train and live by…', value: s.principles || '', onchange: e => { s.principles = e.target.value; PT.save(); PT.toast('Saved'); } }),
    h('h2', {}, 'Quotes'),
    s.quotes.length ? s.quotes.map(x => h('div', { class: 'card' }, h('div', {}, '“' + x.text + '”'), x.by ? h('div', { class: 'small muted' }, x.by) : null,
      h('div', { style: { textAlign: 'right', marginTop: '6px' } }, h('button', { class: 'btn danger small', onclick: () => { s.quotes = s.quotes.filter(y => y.id !== x.id); PT.save(); PT.render(); } }, 'Delete')))) : h('div', { class: 'empty' }, 'No quotes yet. Add the lines that move you.'),
    h('div', { class: 'card' }, PT.field('Quote', h('textarea', { oninput: e => nq.text = e.target.value })), gap(8),
      PT.field('Who said it (optional)', h('input', { oninput: e => nq.by = e.target.value })), gap(10),
      h('button', { class: 'btn block', onclick: () => { if (!nq.text.trim()) { PT.toast('Write the quote first'); return; } s.quotes.push({ id: PT.uid(), text: nq.text.trim(), by: nq.by.trim() }); PT.save(); PT.render(); } }, 'Add quote')));
};

/* ---------- settings & backup ---------- */
/* ---------- backups ---------- */
// Save a backup file (on iPhone: choose Save to Files / iCloud Drive) and remember when.
PT.saveBackup = () => {
  PT.state.settings.lastBackup = PT.today(); PT.save();
  download('pt-backup-' + PT.today() + '.json', JSON.stringify(PT.state, null, 2));
};
PT.copyBackup = () => copyText(JSON.stringify(PT.state, null, 2)).then(() => {
  PT.state.settings.lastBackup = PT.today(); PT.save(); PT.toast('Copied. Paste it into Notes.');
});
PT.daysSinceBackup = () => PT.state.settings.lastBackup ? PT.daysBetween(PT.state.settings.lastBackup, PT.today()) : null;
// Shown on the Plan tab when a backup is 7+ days old (or never made) and there is something worth saving.
PT.backupNudge = () => {
  const s = PT.state, n = PT.daysSinceBackup();
  const hasData = s.logs.length || Object.values(s.plan).some(d => (d.exs || []).length || d.note || d.shift) || s.foods.length;
  if (!hasData || (n != null && n < 7) || s.settings.backupSnooze === PT.today()) return null;
  return h('div', { class: 'card reminder' },
    h('b', { class: 'red' }, 'Back up your data'),
    h('div', { class: 'small', style: { margin: '4px 0 10px' } }, (n == null ? 'You have never made a backup.' : 'Last backup ' + n + ' days ago.') + ' Your data only lives on this phone. Save a copy to Files or iCloud Drive.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small grow', onclick: () => { PT.saveBackup(); PT.render(); } }, 'Save backup'),
      h('button', { class: 'btn ghost small', onclick: () => { s.settings.backupSnooze = PT.today(); PT.save(); PT.render(); } }, 'Later')));
};
function download(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const t = h('textarea', { value: text, style: { position: 'fixed', opacity: 0 } }); document.body.append(t); t.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ } t.remove(); return Promise.resolve();
}
function restoreSheet() {
  let text = '';
  const area = h('textarea', { placeholder: 'Paste your backup text here', oninput: e => text = e.target.value });
  const file = h('input', { type: 'file', accept: '.json,application/json' });
  file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { text = String(r.result); area.value = text; }; r.readAsText(f); });
  const sh = PT.sheet('Restore a backup', h('div', {}, h('p', { class: 'small muted' }, 'This replaces everything in the app with the backup.'), file, gap(10), area, gap(12),
    h('button', { class: 'btn block', onclick: () => {
      let o; try { o = JSON.parse(text); } catch (e) { PT.toast('That is not a valid backup'); return; }
      if (!o || !Array.isArray(o.sessions) || !o.settings) { PT.toast('That does not look like a PT backup'); return; }
      PT.confirm('Replace all current data with this backup?', 'Restore', () => { PT.replaceState(o); sh.close(); PT.toast('Restored'); location.hash = '#/plan'; PT.render(); });
    } }, 'Restore')));
}

// Shift presets: tap one on any day. Named Morning (starts before 12:00) or Evening automatically.
function usualShifts() {
  const st = PT.state.settings; st.shiftPresets = st.shiftPresets || [];
  const box = h('div', {}), n = { start: '07:00', end: '15:00' };
  const draw = () => PT.fill(box,
    st.shiftPresets.length ? st.shiftPresets.map((sh, i) => h('div', { class: 'row between', style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } },
      h('span', {}, PT.shiftText(sh)),
      h('button', { class: 'btn danger small', onclick: () => { st.shiftPresets.splice(i, 1); PT.save(); draw(); } }, '✕'))) : h('div', { class: 'small muted' }, 'None yet. Add your few shift times; on each day you then just tap one.'),
    h('div', { class: 'grid2', style: { margin: '10px 0 8px' } },
      PT.field('Start', h('input', { type: 'time', value: n.start, oninput: e => n.start = e.target.value })),
      PT.field('End', h('input', { type: 'time', value: n.end, oninput: e => n.end = e.target.value }))),
    h('button', { class: 'btn small block', onclick: () => {
      if (!st.shiftPresets.some(x => x.start === n.start && x.end === n.end)) st.shiftPresets.push({ start: n.start, end: n.end });
      st.shiftPresets.sort((x, y) => x.start < y.start ? -1 : 1); PT.save(); draw();
    } }, 'Add usual shift'),
    h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Starting before 12:00 = Morning shift, otherwise Evening shift.'));
  draw();
  return box;
}

PT.moreViews.settings = function () {
  const s = PT.state.settings, ex = 100;
  const prev = h('div', { class: 'small muted' });
  const upd = () => {
    const f = i => ex * PT.factor(i);
    prev.textContent = 'Example: a 100 kg lift becomes ' + Math.round(f(1) / 2.5) * 2.5 + ' kg at 1, ' + Math.round(f(5) / 2.5) * 2.5 + ' kg at 5 and ' + Math.round(f(10) / 2.5) * 2.5 + ' kg at 10. A 10 km run becomes ' + PT.r1(10 * PT.factor(1)) + ' / ' + PT.r1(10 * PT.factor(5)) + ' / ' + PT.r1(10 * PT.factor(10)) + ' km.';
  };
  upd();
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Settings'),
    h('h2', {}, 'Intensity range'),
    h('div', { class: 'card' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Your session as written is the base (100%). Intensity 1 uses your minimum, 10 uses your maximum, and the steps between are even. This scales weights, distances and times.'),
      h('div', { class: 'grid2' }, PT.field('Intensity 1 = % of base', PT.numInput(s.minPct, v => { s.minPct = v; PT.save(); upd(); }, '60', '1')), PT.field('Intensity 10 = % of base', PT.numInput(s.maxPct, v => { s.maxPct = v; PT.save(); upd(); }, '110', '1'))), gap(8), prev),
    h('h2', {}, 'My usual shifts'),
    h('div', { class: 'card' }, usualShifts()),
    h('h2', {}, 'Swimming'),
    h('div', { class: 'card' }, PT.field('Pool length (m) · swims are logged in laps of this', PT.numInput(s.poolM, v => { s.poolM = v; PT.save(); }, '18', '1'))),
    h('h2', {}, 'Body weight'),
    h('div', { class: 'card' }, PT.field('kg (used by the nutrition suggester)', PT.numInput(s.bodyKg, v => { s.bodyKg = v; PT.save(); }, '', '0.1'))),
    h('h2', {}, 'Import calendar'),
    h('div', { class: 'card' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Bring in your shifts, appointments and planned sessions from your calendar or rota using Claude. Copy the instructions, paste them into a Claude chat, then paste the reply back here.'),
      h('button', { class: 'btn small block', onclick: () => PT.importSheet() }, 'Import calendar')),
    h('h2', {}, 'Backup'),
    h('div', { class: 'card' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Your data lives only on this phone, inside this app. Deleting the app or clearing website data erases it. Back up regularly: copy it into a note or save the file.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small grow', onclick: () => { PT.saveBackup(); PT.render(); } }, 'Download file'),
        h('button', { class: 'btn ghost small grow', onclick: () => PT.copyBackup().then(() => PT.render()) }, 'Copy text')),
      h('div', { class: 'small muted', style: { marginTop: '8px' } }, PT.daysSinceBackup() == null ? 'No backup made yet.' : 'Last backup: ' + PT.niceDate(PT.state.settings.lastBackup) + (PT.daysSinceBackup() ? ' (' + PT.daysSinceBackup() + ' days ago)' : ' (today)') + '. On iPhone, choose Save to Files, then iCloud Drive.'),
      gap(8), h('button', { class: 'btn ghost small block', onclick: restoreSheet }, 'Restore from backup')),
    h('p', { class: 'small muted' }, 'App version ' + PT.APP_VERSION),
    h('h2', {}, 'Danger zone'),
    h('button', { class: 'btn danger block', onclick: () => PT.confirm('Erase ALL data in the app? This cannot be undone. Make a backup first if unsure.', 'Erase everything', () => { try { localStorage.removeItem('pt.v1'); } catch (e) { /* ignore */ } location.hash = '#/plan'; location.reload(); }) }, 'Erase all data'))
};
})();
