(function () {
'use strict';
const PT = window.PT, h = PT.h;

PT.views.sessions = function (parts) {
  if (parts[1]) return editor(parts[1]);
  const list = PT.state.sessions;
  return h('div', {},
    h('h1', {}, 'Sessions'),
    h('div', { class: 'row', style: { marginBottom: '14px' } },
      h('a', { class: 'btn grow', href: '#/sessions/new' }, '+ New session'),
      list.length > 1 ? h('button', { class: 'btn ghost', onclick: mergeSheet }, 'Merge') : null),
    list.length ? list.map(card) : h('div', { class: 'empty' }, 'No sessions yet. Build one (e.g. Chest, Tempo run, Swim, MMA class), then drop it into any day of your week.'));
};

function card(s) {
  return h('a', { class: 'card tap', href: '#/sessions/' + s.id },
    h('div', { class: 'row between' }, h('h3', {}, s.name), h('span', { class: 'pill type' }, PT.typeLabel(s.type))),
    h('div', { class: 'muted small' }, s.exercises.length + (s.exercises.length === 1 ? ' exercise' : ' exercises') + (s.tags.length ? ' · ' + s.tags.map(PT.tagLabel).join(', ') : '')),
    s.exercises.length ? h('div', { class: 'small', style: { marginTop: '6px' } }, s.exercises.slice(0, 3).map(e => e.name || 'Unnamed').join(' · ') + (s.exercises.length > 3 ? ' …' : '')) : null);
}

function editor(id) {
  const existing = PT.session(id);
  if (id !== 'new' && !existing) return h('div', {}, PT.back('#/sessions'), h('div', { class: 'empty' }, 'That session no longer exists.'));
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: PT.uid(), name: '', type: 'strength', tags: [], exercises: [] };
  const root = h('div', {});
  const dl = h('datalist', { id: 'exlib' }, PT.state.exercises.map(e => h('option', { value: e.name })));

  function draw() { PT.fill(root, build()); }

  function exCard(ex, i) {
    const body = ex.kind === 'cardio'
      ? [h('div', { class: 'grid3' },
          PT.field('Distance (' + ex.unit + ')', PT.numInput(ex.distance, v => ex.distance = v)),
          PT.field('Pace ' + (ex.unit === 'm' ? '/100m' : '/km'), PT.durInput(ex.pace, v => ex.pace = v)),
          PT.field('Time', PT.durInput(ex.time, v => ex.time = v, 'h:mm:ss'))),
        h('div', { style: { marginTop: '8px' } }, PT.seg([['km', 'km'], ['m', 'metres']], ex.unit, v => { ex.unit = v; draw(); }))]
      : [h('div', { class: 'grid3' },
          PT.field('Sets', PT.numInput(ex.sets, v => ex.sets = v)),
          PT.field('Reps', PT.numInput(ex.reps, v => ex.reps = v)),
          PT.field('Kg', PT.numInput(ex.kg, v => ex.kg = v)))];
    return h('div', { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } },
        h('input', { class: 'grow', placeholder: 'Exercise name', list: 'exlib', value: ex.name, oninput: e => ex.name = e.target.value }),
        h('button', { class: 'btn ghost small', 'aria-label': 'Move up', onclick: () => { if (i > 0) { [draft.exercises[i - 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i - 1]]; draw(); } } }, '↑'),
        h('button', { class: 'btn ghost small', 'aria-label': 'Move down', onclick: () => { if (i < draft.exercises.length - 1) { [draft.exercises[i + 1], draft.exercises[i]] = [draft.exercises[i], draft.exercises[i + 1]]; draw(); } } }, '↓')),
      h('div', { style: { marginBottom: '8px' } }, PT.seg([['strength', 'Strength'], ['cardio', 'Cardio']], ex.kind, v => { ex.kind = v; draw(); })),
      body,
      h('div', { style: { marginTop: '8px' } }, h('input', { placeholder: 'Notes (optional)', value: ex.notes || '', oninput: e => ex.notes = e.target.value })),
      h('div', { style: { marginTop: '8px', textAlign: 'right' } }, h('button', { class: 'btn danger small', onclick: () => { draft.exercises.splice(i, 1); draw(); } }, 'Remove exercise')));
  }

  function build() {
    return [
      dl,
      PT.back('#/sessions'),
      h('h1', {}, existing ? 'Edit session' : 'New session'),
      PT.field('Name', h('input', { placeholder: 'e.g. Chest, Tempo run', value: draft.name, oninput: e => draft.name = e.target.value })),
      h('div', { style: { height: '12px' } }),
      h('label', { class: 'f' }, 'Type'),
      PT.seg(PT.TYPES, draft.type, v => {
        const old = draft.type; draft.type = v;
        if (!draft.tags.length || JSON.stringify(draft.tags) === JSON.stringify(PT.defaultTags[old])) draft.tags = PT.defaultTags[v].slice();
        draw();
      }),
      h('h2', {}, 'Focus areas (used to pick your stretches)'),
      h('p', { class: 'small muted', style: { margin: '0 0 8px' } }, 'Leave empty and they’re picked from your exercises where possible.'),
      PT.chips(PT.TAGS, draft.tags, () => {}),
      h('h2', {}, 'Exercises'),
      draft.exercises.length ? draft.exercises.map(exCard) : h('div', { class: 'empty' }, 'No exercises yet.'),
      h('button', { class: 'btn ghost block', onclick: () => { draft.exercises.push(PT.newEx(draft.type)); draw(); } }, '+ Add exercise'),
      h('div', { style: { height: '18px' } }),
      h('button', { class: 'btn block', onclick: save }, 'Save session'),
      existing ? h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn ghost grow', onclick: duplicate }, 'Duplicate'),
        h('button', { class: 'btn danger grow', onclick: del }, 'Delete')) : null
    ];
  }

  function save() {
    draft.name = draft.name.trim();
    if (!draft.name) { PT.toast('Give the session a name'); return; }
    if (draft.exercises.some(e => !e.name.trim())) { PT.toast('Every exercise needs a name'); return; }
    draft.exercises.forEach(e => e.name = e.name.trim());
    if (!draft.tags.length) { // no focus areas picked: infer them from the exercise library
      const set = new Set();
      draft.exercises.forEach(e => { const lib = PT.state.exercises.find(x => x.name.toLowerCase() === e.name.toLowerCase()); if (lib) lib.muscles.forEach(m => set.add(m)); });
      draft.tags = [...set];
    }
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

function mergeSheet() {
  const picked = new Set();
  const nameIn = h('input', { placeholder: 'Name for the merged session' });
  const list = h('div', {});
  PT.state.sessions.forEach(s => {
    const cb = h('input', { type: 'checkbox' });
    cb.addEventListener('change', () => {
      if (cb.checked) picked.add(s.id); else picked.delete(s.id);
      nameIn.value = PT.state.sessions.filter(x => picked.has(x.id)).map(x => x.name).join(' + ');
    });
    list.append(h('label', { class: 'checkrow' }, cb, h('div', {}, h('div', {}, s.name), h('div', { class: 'small muted' }, PT.typeLabel(s.type) + ' · ' + s.exercises.length + ' exercises'))));
  });
  const sh = PT.sheet('Merge sessions', h('div', {},
    h('p', { class: 'muted small' }, 'Pick two or more. This makes a new combined session (e.g. Chest + Run). Your originals are untouched.'),
    list, h('div', { style: { height: '10px' } }), nameIn, h('div', { style: { height: '12px' } }),
    h('button', { class: 'btn block', onclick: () => {
      const chosen = PT.state.sessions.filter(s => picked.has(s.id));
      if (chosen.length < 2) { PT.toast('Pick at least two'); return; }
      const types = new Set(chosen.map(s => s.type));
      const m = { id: PT.uid(), name: nameIn.value.trim() || chosen.map(s => s.name).join(' + '),
        type: types.size === 1 ? chosen[0].type : 'other',
        tags: [...new Set(chosen.flatMap(s => s.tags))],
        exercises: chosen.flatMap(s => JSON.parse(JSON.stringify(s.exercises))).map(e => Object.assign(e, { id: PT.uid() })) };
      PT.state.sessions.push(m); PT.save(); sh.close(); location.hash = '#/sessions/' + m.id;
    } }, 'Create merged session')));
}
})();
