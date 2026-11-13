(function () {
'use strict';
const PT = window.PT, h = PT.h;
let manualTags = null; // focus areas picked on the Recover tab (null = follow today's plan)

PT.stretchesFor = tags => {
  const s = PT.state, set = new Set(tags);
  const own = s.customStretches.filter(x => x.tags.some(t => set.has(t)));
  let lib = PT.STRETCHES.filter(x => x.tags.some(t => set.has(t)));
  if (s.settings.ownOnly) {
    const covered = new Set(own.flatMap(x => x.tags));
    lib = lib.filter(x => !x.tags.filter(t => set.has(t)).every(t => covered.has(t)));
  }
  return [...own.map(x => Object.assign({ own: true }, x)), ...lib];
};

function recDay(date) {
  const r = PT.state.recoveryLog;
  if (!r[date]) r[date] = { done: {}, sauna: '', bike: '', walk: '' };
  if (!r[date].done) r[date].done = {};
  return r[date];
}

// Checklist of stretches for the focus areas, saved per day.
PT.stretchBlock = (date, tags) => {
  const list = PT.stretchesFor(tags);
  const rec = PT.state.recoveryLog[date];
  const count = () => list.filter(x => ((PT.state.recoveryLog[date] || {}).done || {})[x.id]).length;
  const head = h('div', { class: 'row between' }, h('b', {}, 'Stretch routine'), h('span', { class: 'muted small' }));
  const upd = () => { head.lastChild.textContent = count() + '/' + list.length + ' done'; };
  const card = h('div', { class: 'card' }, h('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'For: ' + tags.map(PT.tagLabel).join(' + ')), head);
  list.forEach(st => {
    const cb = h('input', { type: 'checkbox', checked: !!(rec && rec.done && rec.done[st.id]) });
    const row = h('label', { class: 'checkrow' + (cb.checked ? ' done' : '') }, cb,
      h('div', {}, h('div', { class: 't' }, st.name + (st.own ? ' ★' : ''), h('span', { class: 'muted small' }, ' · ' + st.hold)), h('div', { class: 'small muted' }, st.how || '')));
    cb.addEventListener('change', () => {
      const d = recDay(date); if (cb.checked) d.done[st.id] = true; else delete d.done[st.id];
      row.classList.toggle('done', cb.checked); PT.save(); upd();
    });
    card.append(row);
  });
  if (!list.length) card.append(h('div', { class: 'muted small' }, 'No stretches match yet. Add your own on the Recover tab.'));
  upd();
  return card;
};

// Sauna / bike / walk minutes for a day.
PT.activityBlock = date => {
  const r = PT.state.recoveryLog[date] || {};
  const mk = (key, label) => PT.field(label + ' (min)', PT.numInput(r[key], v => { recDay(date)[key] = v; PT.save(); }, '0', '1'));
  return h('div', { class: 'card' }, h('b', {}, 'Other recovery'), h('div', { class: 'grid3', style: { marginTop: '8px' } }, mk('sauna', 'Sauna'), mk('bike', 'Bike'), mk('walk', 'Walk')));
};

PT.views.recover = function () {
  const date = PT.today();
  const planned = PT.dayTags(date);
  const sel = manualTags ? manualTags.slice() : planned.slice();
  const wk = PT.weekStart(date);
  const tot = { sauna: 0, bike: 0, walk: 0 };
  for (let i = 0; i < 7; i++) { const r = PT.state.recoveryLog[PT.addDays(wk, i)]; if (r) Object.keys(tot).forEach(k => tot[k] += +r[k] || 0); }
  const root = h('div', {}, h('h1', {}, 'Recover'),
    h('h2', {}, 'Focus areas'),
    h('p', { class: 'muted small' }, manualTags ? 'Using the areas you picked.' : (planned.length ? 'Matched to today’s planned sessions. Tap to adjust.' : 'Nothing planned today. Pick the areas you want to stretch.')),
    PT.chips(PT.TAGS, sel, () => { manualTags = sel.slice(); PT.render(); }),
    sel.length ? h('div', {}, PT.stretchBlock(date, sel)) : h('div', { class: 'empty' }, 'Pick at least one area.'),
    h('button', { class: 'btn ghost small', onclick: () => { manualTags = null; PT.render(); } }, 'Reset to today’s plan'),
    h('h2', {}, 'Sauna, bike and walking'),
    PT.activityBlock(date),
    h('div', { class: 'small muted' }, 'This week: sauna ' + tot.sauna + ' min · bike ' + tot.bike + ' min · walk ' + tot.walk + ' min'),
    h('h2', {}, 'My own stretches'),
    h('p', { class: 'muted small' }, 'Add the routines you develop. They show first (★) and can replace the built-in ones.'));
  PT.state.customStretches.forEach(st => root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, st.name), h('button', { class: 'btn danger small', onclick: () => PT.confirm('Delete "' + st.name + '"?', 'Delete', () => { PT.state.customStretches = PT.state.customStretches.filter(x => x.id !== st.id); PT.save(); PT.render(); }) }, 'Delete')),
    h('div', { class: 'small muted' }, st.hold + ' · ' + st.tags.map(PT.tagLabel).join(', ')),
    st.how ? h('div', { class: 'small' }, st.how) : null)));
  root.append(h('button', { class: 'btn ghost block', onclick: addStretch }, '+ Add my own stretch'),
    h('div', { style: { height: '12px' } }),
    h('label', { class: 'checkrow' },
      h('input', { type: 'checkbox', checked: !!PT.state.settings.ownOnly, onchange: e => { PT.state.settings.ownOnly = e.target.checked; PT.save(); PT.render(); } }),
      h('div', {}, h('div', {}, 'Use only my own stretches where I have them'), h('div', { class: 'small muted' }, 'Hides the built-in stretches for any area you’ve covered yourself.'))),
    h('p', { class: 'small muted' }, 'Stretch guidance is general. Skip anything painful and see a physio for injuries.'));
  return root;
};

function addStretch() {
  const d = { name: '', hold: '30s', how: '', tags: [] };
  const sh = PT.sheet('New stretch', h('div', {},
    PT.field('Name', h('input', { oninput: e => d.name = e.target.value })),
    h('div', { style: { height: '10px' } }),
    PT.field('Hold / reps', h('input', { value: d.hold, oninput: e => d.hold = e.target.value })),
    h('div', { style: { height: '10px' } }),
    PT.field('How to do it (optional)', h('textarea', { oninput: e => d.how = e.target.value })),
    h('h2', {}, 'Which sessions is it for?'),
    PT.chips(PT.TAGS, d.tags, () => {}),
    h('button', { class: 'btn block', onclick: () => {
      if (!d.name.trim()) { PT.toast('Name it first'); return; }
      if (!d.tags.length) { PT.toast('Pick at least one area'); return; }
      PT.state.customStretches.push({ id: PT.uid(), name: d.name.trim(), hold: d.hold.trim() || '30s', how: d.how.trim(), tags: d.tags.slice() });
      PT.save(); sh.close(); PT.render();
    } }, 'Save stretch')));
}
})();
