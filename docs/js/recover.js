(function () {
'use strict';
const PT = window.PT, h = PT.h;
const foldOpen = {}; // which day stretch boxes are open
let manualTags = null; // focus areas picked on the Recover tab (null = follow today's plan)

PT.PHASES = [['before', 'Before · prep'], ['after', 'After · cool-down']];
PT.phaseOf = x => x.phase || 'after';
PT.allStretches = () => [...PT.state.customStretches.map(x => Object.assign({ own: true }, x)), ...PT.PREP, ...PT.STRETCHES];
PT.stretchById = id => PT.allStretches().find(x => x.id === id);
// Stretches for these areas. phase 'before' = prep moves, 'after' = cool-down holds.
PT.stretchesFor = (tags, phase) => {
  const s = PT.state, set = new Set(tags), ph = phase || 'after';
  const own = s.customStretches.filter(x => PT.phaseOf(x) === ph && x.tags.some(t => set.has(t)));
  let lib = (ph === 'before' ? PT.PREP : PT.STRETCHES).filter(x => x.tags.some(t => set.has(t)));
  if (s.settings.ownOnly) {
    const covered = new Set(own.flatMap(x => x.tags));
    lib = lib.filter(x => !x.tags.filter(t => set.has(t)).every(t => covered.has(t)));
  }
  return [...own.map(x => Object.assign({ own: true }, x)), ...lib];
};

// Stretches you added to a day yourself (from a folder), per phase.
PT.dayStretchIds = (date, phase) => (((PT.state.plan[date] || {}).stretches || {})[phase]) || [];
PT.addDayStretch = (date, id, phase) => {
  const d = PT.ensureDay(date); d.stretches = d.stretches || { before: [], after: [] };
  const list = d.stretches[phase] = d.stretches[phase] || [];
  if (!list.includes(id)) list.push(id);
  PT.save();
};
function recDay(date) {
  const r = PT.state.recoveryLog;
  if (!r[date]) r[date] = { done: {}, sauna: '', bike: '', walk: '' };
  if (!r[date].done) r[date].done = {};
  return r[date];
}

// Checklist for one phase (before or after), saved per day. Ones you added yourself come first and can be removed.
PT.stretchBlock = (date, tags, phase, withPicked) => {
  phase = phase || 'after';
  const picked = withPicked ? PT.dayStretchIds(date, phase).map(PT.stretchById).filter(Boolean) : [];
  const pickedIds = new Set(picked.map(x => x.id));
  const list = [...picked, ...PT.stretchesFor(tags, phase).filter(x => !pickedIds.has(x.id))];
  const rec = PT.state.recoveryLog[date];
  const count = () => list.filter(x => ((PT.state.recoveryLog[date] || {}).done || {})[x.id]).length;
  const head = h('div', { class: 'row between' }, h('b', {}, phase === 'before' ? 'Before · prep' : 'After · cool-down'), h('span', { class: 'muted small' }));
  const upd = () => { head.lastChild.textContent = list.length ? count() + '/' + list.length + ' done' : ''; };
  // On a day the box folds closed (tap to open) so your exercises stay the first thing you see.
  const outer = h('div', { class: 'card' + (phase === 'before' ? '' : ' folder') });
  let card = outer;
  if (withPicked) {
    const key = date + phase, det = h('details', { class: 'fold', open: !!foldOpen[key] }, h('summary', {}, head));
    det.addEventListener('toggle', () => { foldOpen[key] = det.open; });
    outer.append(det); card = det;
  } else outer.append(head);
  if (tags.length) card.append(h('div', { class: 'small muted', style: { marginTop: '2px' } }, 'For: ' + tags.map(PT.tagLabel).join(' + ')));
  list.forEach(st => {
    const cb = h('input', { type: 'checkbox', checked: !!(rec && rec.done && rec.done[st.id]) });
    const row = h('label', { class: 'checkrow' + (cb.checked ? ' done' : '') }, cb,
      h('div', { class: 'grow' }, h('div', { class: 't' }, st.name + (st.own ? ' ★' : ''), h('span', { class: 'muted small' }, ' · ' + st.hold)), h('div', { class: 'small muted' }, st.how || '')),
      pickedIds.has(st.id) ? h('button', { class: 'btn ghost small', 'aria-label': 'Remove', onclick: ev => {
        ev.preventDefault(); const d = PT.state.plan[date]; d.stretches[phase] = d.stretches[phase].filter(x => x !== st.id); PT.save(); PT.render();
      } }, '✕') : null);
    cb.addEventListener('change', () => {
      const d = recDay(date); if (cb.checked) d.done[st.id] = true; else delete d.done[st.id];
      row.classList.toggle('done', cb.checked); PT.save(); upd();
    });
    card.append(row);
  });
  if (!list.length) card.append(h('div', { class: 'muted small', style: { marginTop: '6px' } }, phase === 'before' ? 'Add exercises to get prep moves matched to them, or pick some from a folder.' : 'Add exercises to get cool-down stretches matched to them, or pick some from a folder.'));
  upd();
  return outer;
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
    sel.length ? h('div', {}, PT.stretchBlock(date, sel, 'before'), PT.stretchBlock(date, sel, 'after')) : h('div', { class: 'empty' }, 'Pick at least one area.'),
    h('button', { class: 'btn ghost small', onclick: () => { manualTags = null; PT.render(); } }, 'Reset to today’s plan'),
    h('h2', {}, 'Sauna, bike and walking'),
    PT.activityBlock(date),
    h('div', { class: 'small muted' }, 'This week: sauna ' + tot.sauna + ' min · bike ' + tot.bike + ' min · walk ' + tot.walk + ' min'),
    h('h2', {}, 'My own stretches'),
    h('p', { class: 'muted small' }, 'Add the prep moves and stretches you develop. They show first (★), live in the folders you pick, and can replace the built-in ones.'));
  PT.state.customStretches.forEach(st => root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, st.name), h('button', { class: 'btn danger small', onclick: () => PT.confirm('Delete "' + st.name + '"?', 'Delete', () => { PT.state.customStretches = PT.state.customStretches.filter(x => x.id !== st.id); PT.save(); PT.render(); }) }, 'Delete')),
    h('div', { class: 'small muted' }, (PT.phaseOf(st) === 'before' ? 'Before' : 'After') + ' · ' + st.hold + ' · ' + st.tags.map(PT.tagLabel).join(', ')),
    st.how ? h('div', { class: 'small' }, st.how) : null)));
  root.append(h('button', { class: 'btn ghost block', onclick: () => { const box = h('div', {}); const sh = PT.sheet('New stretch', box); PT.stretchForm(box, [], 'after', () => { sh.close(); PT.render(); }); } }, '+ Add my own stretch'),
    h('div', { style: { height: '12px' } }),
    h('label', { class: 'checkrow' },
      h('input', { type: 'checkbox', checked: !!PT.state.settings.ownOnly, onchange: e => { PT.state.settings.ownOnly = e.target.checked; PT.save(); PT.render(); } }),
      h('div', {}, h('div', {}, 'Use only my own stretches where I have them'), h('div', { class: 'small muted' }, 'Hides the built-in stretches for any area you’ve covered yourself.'))),
    h('p', { class: 'small muted' }, 'Stretch guidance is general. Skip anything painful and see a physio for injuries.'));
  return root;
};

// Form for your own stretch or prep move. Fills `box`; done(stretch) after saving.
PT.stretchForm = function (box, presetTags, presetPhase, done, back) {
  const d = { name: '', hold: presetPhase === 'before' ? '10 reps' : '30s', how: '', tags: presetTags.slice(), phase: presetPhase || 'after' };
  PT.fill(box,
    back ? h('button', { class: 'back', onclick: back }, '‹ Back') : null,
    h('label', { class: 'f' }, 'When'), PT.seg(PT.PHASES, d.phase, v => d.phase = v),
    h('div', { style: { height: '10px' } }),
    PT.field('Name', h('input', { oninput: e => d.name = e.target.value })),
    h('div', { style: { height: '10px' } }),
    PT.field('Hold / reps', h('input', { value: d.hold, oninput: e => d.hold = e.target.value })),
    h('div', { style: { height: '10px' } }),
    PT.field('How to do it (optional)', h('textarea', { oninput: e => d.how = e.target.value })),
    h('h2', {}, 'Which folders is it for?'),
    PT.chips(PT.TAGS, d.tags, () => {}),
    h('button', { class: 'btn block', onclick: () => {
      if (!d.name.trim()) { PT.toast('Name it first'); return; }
      if (!d.tags.length) { PT.toast('Pick at least one folder'); return; }
      const st = { id: PT.uid(), name: d.name.trim(), hold: d.hold.trim() || '30s', how: d.how.trim(), tags: d.tags.slice(), phase: d.phase };
      PT.state.customStretches.push(st); PT.save(); done(st);
    } }, 'Save stretch'));
};
})();
