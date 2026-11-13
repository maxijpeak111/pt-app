(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

PT.views.sessions = function (parts) {
  if (parts[1]) return editor(parts[1]);
  const list = PT.state.sessions;
  return h('div', {},
    h('h1', {}, 'Sessions'),
    h('a', { class: 'btn block', href: '#/sessions/new', style: { marginBottom: '14px' } }, '+ New session'),
    list.length ? list.map(card) : h('div', { class: 'empty' }, 'No sessions yet. Tap New session, then open the folders (e.g. Strength › Chest and Cardio › Swim) and stack what you want.'));
};

function card(s) {
  return h('a', { class: 'card tap', href: '#/sessions/' + s.id },
    h('div', { class: 'row between' }, h('h3', {}, s.name), h('span', { class: 'pill type' }, PT.typeLabel(s.type))),
    h('div', { class: 'muted small' }, s.exercises.length + (s.exercises.length === 1 ? ' exercise' : ' exercises') + (s.tags.length ? ' · ' + s.tags.map(PT.tagLabel).join(', ') : '')),
    s.exercises.length ? h('div', { class: 'small', style: { marginTop: '6px' } }, s.exercises.slice(0, 4).map(e => e.name).join(' · ') + (s.exercises.length > 4 ? ' …' : '')) : null);
}

/* ---------- your range for one exercise (asked the first time you use it) ---------- */
// Fills `box` with the form; calls done(lib) after saving.
PT.rangeForm = function (box, lib, done, cancel) {
  const r = JSON.parse(JSON.stringify(lib.range || { min: {}, max: {} }));
  let kind = lib.kind || 'strength', unit = lib.unit || ((lib.muscles || []).includes('swim') ? 'm' : 'km');
  function col(which, label) {
    const v = r[which];
    const f = kind === 'strength'
      ? [PT.field('Sets', PT.numInput(v.sets, x => v.sets = x, '', '1')), PT.field('Reps', PT.numInput(v.reps, x => v.reps = x, '', '1')), PT.field('Kg', PT.numInput(v.kg, x => v.kg = x, 'body', '0.5'))]
      : kind === 'cardio'
        ? [PT.field('Distance (' + unit + ')', PT.numInput(v.distance, x => v.distance = x)), PT.field('Time', PT.durInput(v.time, x => v.time = x, 'h:mm:ss'))]
        : [PT.field('Rounds', PT.numInput(v.rounds, x => v.rounds = x, '', '1')), PT.field('Time per round', PT.durInput(v.time, x => v.time = x, 'm:ss'))];
    return h('div', { class: 'card', style: { margin: 0 } }, h('b', { class: which === 'max' ? 'red' : '' }, label), gap(6), f.map(x => h('div', { style: { marginBottom: '6px' } }, x)));
  }
  function draw() {
    PT.fill(box,
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Tell the app your own range once. Level 1 is your warm-up or easiest, level 10 is your max. After this you just pick a level.'),
      h('label', { class: 'f' }, 'Measured by'), PT.seg(PT.KINDS, kind, v => { kind = v; draw(); }), gap(8),
      kind === 'cardio' ? h('div', { style: { marginBottom: '8px' } }, PT.seg([['km', 'km'], ['m', 'metres']], unit, v => { unit = v; draw(); })) : null,
      h('div', { class: 'grid2' }, col('min', 'Level 1 · warm-up'), col('max', 'Level 10 · max')), gap(12),
      h('div', { class: 'row' },
        cancel ? h('button', { class: 'btn ghost grow', onclick: cancel }, 'Back') : null,
        h('button', { class: 'btn grow', onclick: () => {
          const keys = kind === 'strength' ? ['sets', 'reps', 'kg'] : kind === 'cardio' ? ['distance', 'time'] : ['rounds', 'time'];
          const any = w => keys.some(k => +r[w][k]);
          if (!any('min') || !any('max')) { PT.toast('Fill in both levels'); return; }
          lib.kind = kind; lib.unit = kind === 'cardio' ? unit : ''; lib.range = { min: pick(r.min, keys), max: pick(r.max, keys) };
          PT.save(); done(lib);
        } }, 'Save range')));
  }
  const pick = (o, keys) => keys.reduce((a, k) => (a[k] = o[k] === '' || o[k] == null ? '' : +o[k], a), {});
  draw();
};

// Level 1–10 chooser with a live preview of what that means for you.
PT.levelForm = function (box, lib, level, onPick, back, addLabel) {
  let lv = level || 7;
  const out = h('div', { class: 'stat', style: { margin: '6px 0' } }), lab = h('div', { class: 'red', style: { fontWeight: 800 } });
  const upd = () => { lab.textContent = 'Level ' + lv + ' / 10'; out.textContent = PT.exText(PT.atLevel(lib, lv)); };
  const slider = h('input', { type: 'range', min: 1, max: 10, step: 1, value: lv });
  slider.addEventListener('input', () => { lv = +slider.value; upd(); });
  upd();
  PT.fill(box,
    h('h3', {}, lib.name), gap(8), lab, out, slider,
    h('div', { class: 'row between small muted' }, h('span', {}, 'Warm-up'), h('span', {}, 'Max')), gap(12),
    h('div', { class: 'row' },
      back ? h('button', { class: 'btn ghost grow', onclick: back }, 'Back') : null,
      h('button', { class: 'btn grow', onclick: () => onPick(lv) }, addLabel || 'Add')),
    gap(10), h('button', { class: 'btn ghost small block', onclick: () => PT.rangeForm(box, lib, () => PT.levelForm(box, lib, lv, onPick, back, addLabel), () => PT.levelForm(box, lib, lv, onPick, back, addLabel)) }, 'Change my range'));
};

/* ---------- folder browser: pick exercises or whole saved sessions ---------- */
// onAdd(list of session-exercises), called each time something is added. The sheet stays open so you can stack.
PT.browseSheet = function (onAdd, opts) {
  opts = opts || {};
  const box = h('div', {});
  const sh = PT.sheet('Add exercises', box);
  let added = 0;
  const addedLine = () => added ? h('div', { class: 'small red', style: { marginBottom: '8px', fontWeight: 700 } }, added + ' added · keep stacking or tap Done') : null;
  const done = h('button', { class: 'btn block', style: { marginTop: '14px' }, onclick: () => sh.close() }, 'Done');

  function home() {
    let q = '';
    const results = h('div', {});
    const search = h('input', { placeholder: 'Search all exercises', oninput: e => { q = e.target.value.trim().toLowerCase(); drawResults(); } });
    function drawResults() {
      if (!q) { PT.fill(results, folders()); return; }
      const rows = PT.state.exercises.filter(e => e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      PT.fill(results, rows.length ? rows.map(e => exRow(e, home)) : h('div', { class: 'empty' }, 'No matches.'));
    }
    function folders() {
      const mine = PT.state.sessions.filter(s => s.id !== opts.skipId);
      return [
        !opts.noSessions && mine.length ? h('div', { class: 'card tap folder', onclick: sessionsFolder }, h('div', { class: 'row between' }, h('b', {}, '★ My sessions'), h('span', { class: 'muted small' }, mine.length + ' ›'))) : null,
        PT.FOLDERS.map(([group, list]) => [h('h2', {}, group), h('div', { class: 'folders' }, list.map(([tag, label]) => {
          const n = PT.state.exercises.filter(e => (e.muscles || []).includes(tag)).length;
          return h('div', { class: 'folder-tile', onclick: () => folder(tag, group + ' › ' + label) }, h('b', {}, label), h('span', { class: 'small muted' }, n + ' exercises'));
        }))])
      ];
    }
    PT.fill(box, addedLine(), search, gap(4), results, done);
    drawResults();
  }

  function exRow(lib, back, from) {
    const set = PT.hasRange(lib);
    return h('div', { class: 'card tap', onclick: () => choose(lib, back, from) },
      h('div', { class: 'row between' }, h('b', {}, lib.name), h('span', { class: 'pill' + (set ? ' done' : '') }, set ? 'range set' : 'first time')),
      set ? h('div', { class: 'small muted' }, PT.exText(PT.atLevel(lib, 1)) + '  →  ' + PT.exText(PT.atLevel(lib, 10))) : null);
  }

  function folder(tag, title) {
    const rows = PT.state.exercises.filter(e => (e.muscles || []).includes(tag)).sort((a, b) => a.name.localeCompare(b.name));
    PT.fill(box, h('button', { class: 'back', onclick: home }, '‹ Folders'), h('h2', { style: { marginTop: '4px' } }, title), addedLine(),
      rows.length ? rows.map(e => exRow(e, () => folder(tag, title), title.split(' › ')[1])) : h('div', { class: 'empty' }, 'Nothing here yet.'),
      h('button', { class: 'btn ghost block', onclick: () => newEx(tag, () => folder(tag, title), title.split(' › ')[1]) }, '+ New exercise in this folder'), done);
  }

  function newEx(tag, back, from) {
    const d = { name: '' };
    PT.fill(box, h('button', { class: 'back', onclick: back }, '‹ Back'), h('h2', {}, 'New exercise'),
      PT.field('Name', h('input', { placeholder: 'e.g. Dumbbell fly', oninput: e => d.name = e.target.value })), gap(12),
      h('button', { class: 'btn block', onclick: () => {
        const name = d.name.trim(); if (!name) { PT.toast('Name it first'); return; }
        if (PT.state.exercises.some(e => e.name.toLowerCase() === name.toLowerCase())) { PT.toast('You already have that one'); return; }
        const kind = ['run', 'swim', 'bike'].includes(tag) ? 'cardio' : tag === 'mma' ? 'time' : 'strength';
        const lib = { id: PT.uid(), name, muscles: [tag], kind, unit: tag === 'swim' ? 'm' : 'km', notes: '', link: '' };
        PT.state.exercises.push(lib); PT.save(); choose(lib, back, from);
      } }, 'Next: set your range'));
  }

  function choose(lib, back, from) {
    if (!from) { const t = (lib.muscles || [])[0]; from = t ? PT.tagLabel(t) : lib.name; }
    const pickLevel = () => PT.levelForm(box, lib, 7, lv => {
      onAdd([{ id: PT.uid(), exId: lib.id, name: lib.name, kind: lib.kind, level: lv }], null, from);
      added++; PT.toast('Added ' + lib.name + ' · level ' + lv); back();
    }, back);
    if (PT.hasRange(lib)) pickLevel(); else PT.rangeForm(box, lib, pickLevel, back);
  }

  function sessionsFolder() {
    const mine = PT.state.sessions.filter(s => s.id !== opts.skipId);
    PT.fill(box, h('button', { class: 'back', onclick: home }, '‹ Folders'), h('h2', { style: { marginTop: '4px' } }, 'My sessions'), addedLine(),
      h('p', { class: 'small muted' }, 'Tap one to stack all of its exercises in, at the levels you saved.'),
      mine.map(s => h('div', { class: 'card tap', onclick: () => {
        onAdd(s.exercises.map(e => Object.assign(JSON.parse(JSON.stringify(e)), { id: PT.uid() })), s, s.name);
        added += s.exercises.length; PT.toast('Added ' + s.name); sessionsFolder();
      } }, h('div', { class: 'row between' }, h('b', {}, s.name), h('span', { class: 'pill' }, PT.typeLabel(s.type))),
        h('div', { class: 'small muted' }, s.exercises.map(e => e.name).join(' · ')))), done);
  }
  home();
  return sh;
};

/* ---------- session editor ---------- */
function deriveTags(exs) {
  const set = new Set();
  exs.forEach(e => { const lib = PT.libEx(e); if (lib) (lib.muscles || []).forEach(m => set.add(m)); });
  return [...set];
}
function deriveType(tags, exs) {
  const sports = ['run', 'swim', 'bike', 'mma'].filter(t => tags.includes(t));
  const hasStrength = exs.some(e => { const l = PT.libEx(e); return (l ? l.kind : e.kind) === 'strength'; });
  if (sports.length === 1 && !hasStrength) return sports[0];
  if (!sports.length) return 'strength';
  return 'other';
}

function editor(id) {
  const existing = PT.session(id);
  if (id !== 'new' && !existing) return h('div', {}, PT.back('#/sessions'), h('div', { class: 'empty' }, 'That session no longer exists.'));
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: PT.uid(), name: '', type: 'strength', tags: [], exercises: [] };
  const parts = []; // names of what was stacked, used to suggest a session name
  let nameTouched = !!existing;
  const root = h('div', {});
  const nameIn = h('input', { placeholder: 'e.g. Chest + Swim', value: draft.name, oninput: e => { draft.name = e.target.value; nameTouched = true; } });

  function suggestName() {
    if (nameTouched) return;
    draft.name = parts.slice(0, 4).join(' + ');
    nameIn.value = draft.name;
  }

  function exCard(ex, i) {
    const lib = PT.libEx(ex), ranged = PT.hasRange(lib);
    const lv = ex.level || 7;
    const preview = PT.exText(PT.target(ex, lv));
    const step = d => { ex.level = Math.min(10, Math.max(1, lv + d)); draw(); };
    return h('div', { class: 'card' },
      h('div', { class: 'row between', style: { flexWrap: 'nowrap' } },
        h('b', {}, ex.name),
        h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '4px' } },
          h('button', { class: 'btn ghost small', 'aria-label': 'Move up', onclick: () => { if (i > 0) { [draft.exercises[i - 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i - 1]]; draw(); } } }, '↑'),
          h('button', { class: 'btn ghost small', 'aria-label': 'Move down', onclick: () => { if (i < draft.exercises.length - 1) { [draft.exercises[i + 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i + 1]]; draw(); } } }, '↓'),
          h('button', { class: 'btn danger small', 'aria-label': 'Remove', onclick: () => { draft.exercises.splice(i, 1); draw(); } }, '✕'))),
      h('div', { class: 'stepper' },
        h('button', { class: 'btn ghost small', onclick: () => step(-1) }, '−'),
        h('div', { class: 'grow' }, h('div', { class: 'red', style: { fontWeight: 800 } }, 'Level ' + lv), h('div', { class: 'small' }, preview)),
        h('button', { class: 'btn ghost small', onclick: () => step(1) }, '+')),
      !ranged && lib ? h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => {
        const box = h('div', {}); const sh = PT.sheet('Your range: ' + lib.name, box);
        PT.rangeForm(box, lib, () => { ex.exId = lib.id; sh.close(); draw(); });
      } }, 'Set my range for this (warm-up → max)') : null,
      !lib ? h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Not in your exercise library, so it scales from what was written.') : null);
  }

  function draw() {
    PT.fill(root,
      PT.back('#/sessions'),
      h('h1', {}, existing ? 'Edit session' : 'New session'),
      PT.field('Name', nameIn), gap(14),
      h('button', { class: 'btn block', onclick: () => PT.browseSheet((list, fromSession, from) => {
        draft.exercises.push(...list);
        if (from && !parts.includes(from)) parts.push(from);
        suggestName(); draw();
      }, { skipId: draft.id }) }, '+ Add from folders'),
      h('h2', {}, draft.exercises.length ? 'Exercises · ' + draft.exercises.length : 'Exercises'),
      draft.exercises.length ? draft.exercises.map(exCard) : h('div', { class: 'empty' }, 'Open the folders and stack what you want, e.g. Strength › Chest then Cardio › Swim. You can also add a whole saved session.'),
      gap(18),
      h('button', { class: 'btn block', onclick: save }, 'Save session'),
      existing ? h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn ghost grow', onclick: duplicate }, 'Duplicate'),
        h('button', { class: 'btn danger grow', onclick: del }, 'Delete')) : null);
  }

  function save() {
    draft.name = draft.name.trim();
    if (!draft.exercises.length) { PT.toast('Add at least one exercise'); return; }
    if (!draft.name) { PT.toast('Give the session a name'); return; }
    draft.tags = deriveTags(draft.exercises);
    if (!draft.tags.length) draft.tags = (existing && existing.tags) || [];
    draft.type = deriveType(draft.tags, draft.exercises);
    const i = PT.state.sessions.findIndex(s => s.id === draft.id);
    if (i >= 0) PT.state.sessions[i] = draft; else PT.state.sessions.push(draft);
    PT.save(); PT.toast('Saved'); location.hash = '#/sessions';
  }
  function duplicate() {
    const c = JSON.parse(JSON.stringify(draft));
    c.id = PT.uid(); c.name = c.name + ' (copy)'; c.exercises.forEach(e => e.id = PT.uid());
    PT.state.sessions.push(c); PT.save(); PT.toast('Duplicated'); location.hash = '#/sessions/' + c.id;
  }
  function del() {
    PT.confirm('Delete "' + draft.name + '"? Planned (not yet logged) uses of it are removed from your plan. Logged sessions are kept.', 'Delete', () => {
      PT.state.sessions = PT.state.sessions.filter(s => s.id !== draft.id);
      Object.values(PT.state.plan).forEach(d => d.items = (d.items || []).filter(it => it.sessionId !== draft.id || it.logId));
      PT.save(); location.hash = '#/sessions';
    });
  }
  draw();
  return root;
}
})();
