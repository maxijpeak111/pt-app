(function () {
'use strict';
const PT = window.PT, h = PT.h;
const foldOpen = {}; // which day stretch boxes are open

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

// What a day's Before/After box holds: ones you picked first, then best matches (most matching folders first).
// Only the first SHOW appear until you tap "Show more"; Progress counts those as planned.
PT.stretchList = (date, tags, phase, withPicked) => {
  const picked = withPicked !== false ? PT.dayStretchIds(date, phase).map(PT.stretchById).filter(Boolean) : [];
  const pickedIds = new Set(picked.map(x => x.id));
  const score = x => x.tags.filter(t => tags.includes(t)).length;
  const auto = PT.stretchesFor(tags, phase).filter(x => !pickedIds.has(x.id)).sort((a, b) => score(b) - score(a));
  return { list: [...picked, ...auto], SHOW: Math.max(6, picked.length), pickedIds };
};
// Checklist for one phase (before or after), saved per day. Ones you added yourself come first and can be removed.
PT.stretchBlock = (date, tags, phase, withPicked) => {
  phase = phase || 'after';
  const { list, SHOW, pickedIds } = PT.stretchList(date, tags, phase, withPicked);
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
  const extra = [];
  list.forEach((st, idx) => {
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
    if (idx >= SHOW) { row.style.display = 'none'; extra.push(row); }
    card.append(row);
  });
  if (extra.length) {
    const more = h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => { extra.forEach(r => r.style.display = ''); more.remove(); } }, 'Show ' + extra.length + ' more');
    card.append(more);
  }
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

/* ---------- Library tab: sessions, exercises, meals, recovery ---------- */
PT.views.recover = () => PT.views.library(['library', 'recovery']); // old link
PT.views.library = function (parts) {
  const sub = parts[1];
  if (sub === 'exercises') return PT.moreViews.exercises(['library', 'exercises', parts[2], parts[3]]);
  if (sub === 'meals') return PT.mealsView();
  if (sub === 'foods') return PT.foodsView();
  if (sub === 'recovery') return parts[2] === 'r' ? routineEditor(parts[3]) : parts[2] === 'f' ? stretchFolder(parts[3]) : recoveryLibrary();
  const s = PT.state;
  const tile = (href, title, sub2) => h('a', { class: 'card tap folder', href },
    h('div', { class: 'row between' }, h('b', { style: { fontSize: '18px' } }, title), h('span', { class: 'red' }, '›')), h('div', { class: 'small muted' }, sub2));
  return h('div', {}, h('h1', {}, 'Library'),
    tile('#/sessions', '★ Session library', s.sessions.length + ' saved sessions · drop a whole session into any day'),
    tile('#/library/exercises', 'Exercise library', s.exercises.length + ' exercises in body-part folders'),
    tile('#/library/meals', 'Meal library', s.meals.length + ' usual meals · ' + s.foods.length + ' foods · daily macro goals'),
    tile('#/library/recovery', 'Recovery library', s.routines.length + ' routines · warm-ups and stretches by folder'));
};

/* ---------- Recovery library: routines + stretch folders ---------- */
function recoveryLibrary() {
  const s = PT.state;
  const n = tag => PT.allStretches().filter(x => x.tags.includes(tag)).length;
  return h('div', {}, PT.back('#/library', 'Library'), h('h1', {}, 'Recovery library'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Build routines you repeat (e.g. "Post-run cool-down"). On any day, tap Add exercises → ★ Recovery routines to drop one into the Before or After box, or pick single stretches from the folders.'),
    h('h2', {}, 'Routines'),
    s.routines.length ? s.routines.map(r => h('a', { class: 'card tap', href: '#/library/recovery/r/' + r.id },
      h('div', { class: 'row between' }, h('b', {}, r.name || 'Untitled routine'), h('span', { class: 'pill' }, r.phase === 'before' ? 'Before' : 'After')),
      h('div', { class: 'small muted' }, r.items.map(id => (PT.stretchById(id) || {}).name).filter(Boolean).join(' · ') || 'No moves yet'))) : h('div', { class: 'empty' }, 'No routines yet.'),
    h('button', { class: 'btn block', onclick: () => { const r = { id: PT.uid(), name: '', phase: 'after', items: [] }; s.routines.push(r); PT.save(); location.hash = '#/library/recovery/r/' + r.id; } }, '+ New routine'),
    h('h2', {}, 'Warm-ups and stretches by folder'),
    h('div', { class: 'folders' }, PT.TAGS.map(([tag, label]) => h('a', { class: 'folder-tile', href: '#/library/recovery/f/' + tag }, h('b', {}, label), h('span', { class: 'small muted' }, n(tag) + ' moves')))),
    h('div', { style: { height: '14px' } }),
    h('label', { class: 'checkrow' },
      h('input', { type: 'checkbox', checked: !!s.settings.ownOnly, onchange: e => { s.settings.ownOnly = e.target.checked; PT.save(); } }),
      h('div', {}, h('div', {}, 'Use only my own stretches where I have them'), h('div', { class: 'small muted' }, 'Hides built-in ones for any folder you have covered yourself (★).'))),
    h('p', { class: 'small muted' }, 'Stretch guidance is general. Skip anything painful and see a physio for injuries.'));
}

function stretchFolder(tag) {
  const label = PT.tagLabel(tag);
  const row = st => h('div', { class: 'card' },
    h('div', { class: 'row between', style: { flexWrap: 'nowrap' } }, h('div', {}, h('b', {}, st.name + (st.own ? ' ★' : '')), h('div', { class: 'small muted' }, st.hold)),
      st.own ? h('button', { class: 'btn danger small', onclick: () => PT.confirm('Delete "' + st.name + '"?', 'Delete', () => { PT.state.customStretches = PT.state.customStretches.filter(x => x.id !== st.id); PT.save(); PT.render(); }) }, '✕') : null),
    st.how ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, st.how) : null);
  return h('div', {}, PT.back('#/library/recovery', 'Recovery library'), h('h1', {}, label),
    PT.PHASES.map(([ph]) => {
      const list = PT.allStretches().filter(x => PT.phaseOf(x) === ph && x.tags.includes(tag));
      return PT.section('rec-' + tag + ph, ph === 'before' ? 'Before · warm-up' : 'After · stretches', list.length + ' moves', [
        list.length ? list.map(row) : h('div', { class: 'small muted' }, 'None yet.'),
        h('button', { class: 'btn ghost small block', onclick: () => { const box = h('div', {}); const sh = PT.sheet('New ' + (ph === 'before' ? 'warm-up move' : 'stretch'), box); PT.stretchForm(box, [tag], ph, () => { sh.close(); PT.render(); }); } }, '+ New ' + (ph === 'before' ? 'warm-up move' : 'stretch') + ' in ' + label)]);
    }));
}

function routineEditor(id) {
  const r = PT.state.routines.find(x => x.id === id);
  if (!r) return h('div', {}, PT.back('#/library/recovery', 'Recovery library'), h('div', { class: 'empty' }, 'That routine no longer exists.'));
  const root = h('div', {});
  function pick() {
    // tick moves from folders; only this routine's phase is shown
    const box = h('div', {}); const sh = PT.sheet('Add moves', box);
    const draw = () => PT.fill(box,
      PT.TAGS.map(([tag, label]) => {
        const list = PT.allStretches().filter(x => PT.phaseOf(x) === r.phase && x.tags.includes(tag));
        if (!list.length) return null;
        const det = h('details', { class: 'section sub' }, h('summary', {}, h('div', { class: 'grow' }, h('div', { class: 'sec-title' }, label)), h('span', { class: 'muted small' }, String(list.length)), h('span', { class: 'chev' })),
          h('div', { class: 'sec-body' }, list.map(st => h('div', { class: 'card tap', onclick: () => {
            const i = r.items.indexOf(st.id); if (i >= 0) r.items.splice(i, 1); else r.items.push(st.id); PT.save(); draw(); drawPage();
          } }, h('div', { class: 'row between' }, h('b', {}, st.name), h('span', { class: r.items.includes(st.id) ? 'ok' : 'red', style: { fontWeight: 800, fontSize: '20px' } }, r.items.includes(st.id) ? '✓' : '+'))))));
        if (list.some(st => r.items.includes(st.id))) det.open = true;
        return det;
      }),
      h('button', { class: 'btn block', onclick: () => sh.close() }, 'Done'));
    draw();
  }
  function drawPage() {
    PT.fill(root, PT.back('#/library/recovery', 'Recovery library'), h('h1', {}, r.name || 'New routine'),
      PT.field('Name', h('input', { value: r.name, placeholder: 'e.g. Post-run cool-down', oninput: e => { r.name = e.target.value; PT.save(); } })),
      h('div', { style: { height: '10px' } }),
      h('label', { class: 'f' }, 'When'), PT.seg(PT.PHASES, r.phase, v => { r.phase = v; r.items = r.items.filter(i => PT.phaseOf(PT.stretchById(i) || {}) === v); PT.save(); drawPage(); }),
      h('h2', {}, 'Moves · ' + r.items.length),
      r.items.length ? r.items.map((sid, i) => { const st = PT.stretchById(sid); return st ? h('div', { class: 'card row between', style: { flexWrap: 'nowrap' } },
        h('div', {}, h('b', {}, st.name), h('div', { class: 'small muted' }, st.hold)),
        h('button', { class: 'btn ghost small', onclick: () => { r.items.splice(i, 1); PT.save(); drawPage(); } }, '✕')) : null; }) : h('div', { class: 'empty' }, 'No moves yet.'),
      h('button', { class: 'btn ghost block', onclick: pick }, '+ Add moves from folders'),
      h('div', { style: { height: '14px' } }),
      h('button', { class: 'btn block', onclick: () => { if (!r.name.trim()) { PT.toast('Give it a name'); return; } PT.save(); PT.toast('Saved'); location.hash = '#/library/recovery'; } }, 'Save routine'),
      h('button', { class: 'btn danger block', style: { marginTop: '10px' }, onclick: () => PT.confirm('Delete "' + (r.name || 'this routine') + '"?', 'Delete', () => { PT.state.routines = PT.state.routines.filter(x => x.id !== r.id); PT.save(); location.hash = '#/library/recovery'; }) }, 'Delete routine'));
  }
  drawPage();
  return root;
}

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
