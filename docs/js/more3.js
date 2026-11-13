(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

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

PT.moreViews.settings = function () {
  const s = PT.state.settings, ex = 100;
  const prev = h('div', { class: 'small muted' });
  const upd = () => {
    const f = i => ex * PT.factor(i);
    prev.textContent = 'Example: a 100 kg lift becomes ' + Math.round(f(1) / 2.5) * 2.5 + ' kg at 1, ' + Math.round(f(5) / 2.5) * 2.5 + ' kg at 5 and ' + Math.round(f(10) / 2.5) * 2.5 + ' kg at 10. A 10 km run becomes ' + PT.r1(10 * PT.factor(1)) + ' / ' + PT.r1(10 * PT.factor(5)) + ' / ' + PT.r1(10 * PT.factor(10)) + ' km.';
  };
  upd();
  const json = () => JSON.stringify(PT.state, null, 2);
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Settings'),
    h('h2', {}, 'Intensity range'),
    h('div', { class: 'card' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Your session as written is the base (100%). Intensity 1 uses your minimum, 10 uses your maximum, and the steps between are even. This scales weights, distances and times.'),
      h('div', { class: 'grid2' }, PT.field('Intensity 1 = % of base', PT.numInput(s.minPct, v => { s.minPct = v; PT.save(); upd(); }, '60', '1')), PT.field('Intensity 10 = % of base', PT.numInput(s.maxPct, v => { s.maxPct = v; PT.save(); upd(); }, '110', '1'))), gap(8), prev),
    h('h2', {}, 'Body weight'),
    h('div', { class: 'card' }, PT.field('kg (used by the nutrition suggester)', PT.numInput(s.bodyKg, v => { s.bodyKg = v; PT.save(); }, '', '0.1'))),
    h('h2', {}, 'Backup'),
    h('div', { class: 'card' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Your data lives only on this phone, inside this app. Deleting the app or clearing website data erases it. Back up regularly: copy it into a note or save the file.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small grow', onclick: () => { download('pt-backup-' + PT.today() + '.json', json()); } }, 'Download file'),
        h('button', { class: 'btn ghost small grow', onclick: () => copyText(json()).then(() => PT.toast('Copied. Paste it into Notes.')) }, 'Copy text')),
      gap(8), h('button', { class: 'btn ghost small block', onclick: restoreSheet }, 'Restore from backup')),
    h('h2', {}, 'Danger zone'),
    h('button', { class: 'btn danger block', onclick: () => PT.confirm('Erase ALL data in the app? This cannot be undone. Make a backup first if unsure.', 'Erase everything', () => { try { localStorage.removeItem('pt.v1'); } catch (e) { /* ignore */ } location.hash = '#/plan'; location.reload(); }) }, 'Erase all data'))
};
})();
