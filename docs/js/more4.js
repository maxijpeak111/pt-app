(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });
const DOW = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const num = v => (v === '' || v == null) ? 0 : +v;
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- regular schedule ----------
   state.regular = [{ id, title, days: [0–6], time, auto, exIds: [], sessionId }]
   auto = added to the plan by itself on those days; otherwise it's suggested there and you tap + Add.
   Per day: plan[date].reg[id] = 'added' | 'done' | 'skipped'. Adding one with exercises puts them on the day. */
PT.regularFor = date => { const dow = PT.parse(date).getDay(); return (PT.state.regular || []).filter(r => (r.days || []).includes(dow)); };
const regState = (date, r) => ((PT.state.plan[date] || {}).reg || {})[r.id] || (r.auto ? 'added' : '');
const setReg = (date, r, v) => { const d = PT.ensureDay(date); d.reg = d.reg || {}; d.reg[r.id] = v; };
PT.regularLines = date => {
  const items = PT.regularFor(date), on = items.filter(r => ['added', 'done'].includes(regState(date, r)));
  const sug = items.filter(r => !regState(date, r));
  return { on, sug };
};
function addRegular(date, r) {
  setReg(date, r, 'added');
  const d = PT.ensureDay(date), add = x => d.exs.push(PT.makeEntry(x, { fromRegular: r.id }));
  if (!d.exs.some(e => e.fromRegular === r.id)) {
    const s = r.sessionId && PT.session(r.sessionId);
    if (s) s.exercises.forEach(e => add(Object.assign(JSON.parse(JSON.stringify(e)), { id: PT.uid() })));
    (r.exIds || []).map(id => PT.state.exercises.find(e => e.id === id)).filter(Boolean).forEach(lib => add({ exId: lib.id, name: lib.name, kind: lib.kind, level: 7 }));
    PT.syncDayLog(date);
  }
  PT.save();
}
/* ---------- the day's agenda: calendar events + regular items together, earliest first ----------
   Each row can be ticked off. Suggested regular items show + Add / ✕ until you decide. Untimed things go last. */
PT.dayAgenda = date => {
  const day = PT.state.plan[date] || {};
  const rows = (day.events || []).map(ev => ({ kind: 'event', id: ev.id, title: ev.title, time: ev.start || '', end: ev.end || '', done: !!ev.done, ev }));
  PT.regularFor(date).forEach(r => { const st = regState(date, r); if (st !== 'skipped') rows.push({ kind: 'reg', id: r.id, title: r.title, time: r.time || '', done: st === 'done', suggested: !st, r }); });
  return rows.sort((a, b) => (a.time || '99:99') < (b.time || '99:99') ? -1 : (a.time || '99:99') > (b.time || '99:99') ? 1 : 0);
};
PT.agendaText = x => (x.time ? x.time + (x.end ? '–' + x.end : '') + ' ' : '') + x.title;
PT.agendaList = date => {
  const rows = PT.dayAgenda(date);
  if (!rows.length) return h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Nothing on. Add an event below, or set up regular things in More → Regular schedule.');
  return h('div', { class: 'card' }, rows.map(x => {
    const label = h('div', { class: 'grow' }, h('div', { class: 't' }, x.title), x.time ? h('div', { class: 'small muted' }, x.time + (x.end ? '–' + x.end : '')) : null);
    if (x.suggested) return h('div', { class: 'checkrow suggested' }, h('span', { class: 'sug-dot' }, '+'), label,
      h('button', { class: 'btn small', onclick: () => { addRegular(date, x.r); PT.toast('Added ' + x.title); PT.render(); } }, 'Add'),
      h('button', { class: 'btn ghost small', 'aria-label': 'Not today', onclick: () => { setReg(date, x.r, 'skipped'); PT.save(); PT.render(); } }, '✕'));
    const cb = h('input', { type: 'checkbox', checked: x.done });
    cb.addEventListener('change', () => {
      if (x.kind === 'event') x.ev.done = cb.checked; else setReg(date, x.r, cb.checked ? 'done' : 'added');
      PT.save(); PT.render();
    });
    return h('label', { class: 'checkrow' + (x.done ? ' done' : '') }, cb, label,
      x.kind === 'event' ? h('button', { class: 'btn ghost small', 'aria-label': 'Delete event', onclick: ev => { ev.preventDefault(); const d = PT.ensureDay(date); d.events = d.events.filter(e => e.id !== x.id); PT.save(); PT.render(); } }, '✕') : null);
  }));
};

// The "Regular" card on a day: your automatic items to tick off, and suggestions you can add or dismiss.
PT.regularBlock = date => {
  const items = PT.regularFor(date).filter(r => regState(date, r) !== 'skipped');
  if (!items.length) return null;
  const row = r => {
    const st = regState(date, r), label = h('div', { class: 'grow' }, h('div', { class: 't' }, r.title), r.time ? h('div', { class: 'small muted' }, r.time) : null);
    if (!st) return h('div', { class: 'checkrow' }, label,
      h('button', { class: 'btn small', onclick: () => { addRegular(date, r); PT.toast('Added ' + r.title); PT.render(); } }, '+ Add'),
      h('button', { class: 'btn ghost small', 'aria-label': 'Not today', onclick: () => { setReg(date, r, 'skipped'); PT.save(); PT.render(); } }, '✕'));
    const cb = h('input', { type: 'checkbox', checked: st === 'done' });
    cb.addEventListener('change', () => { setReg(date, r, cb.checked ? 'done' : 'added'); PT.save(); PT.render(); });
    return h('label', { class: 'checkrow' + (st === 'done' ? ' done' : '') }, cb, label);
  };
  const on = items.filter(r => regState(date, r)), sug = items.filter(r => !regState(date, r));
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, 'Regular'), h('a', { class: 'small muted', href: '#/more/regular' }, 'Edit ›')),
    on.map(row),
    sug.length ? [h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Suggested'), sug.map(row)] : null);
};

PT.moreViews.regular = function () {
  const list = PT.state.regular = PT.state.regular || [];
  const daysText = d => d.length === 7 ? 'Every day' : DOW.filter(([v]) => d.includes(v)).map(x => x[1]).join(', ');
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Regular schedule'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Things that come round each week. "Automatic" ones go onto your plan by themselves; "Suggested" ones show on those days for you to add with one tap.'),
    h('button', { class: 'btn block', style: { marginBottom: '12px' }, onclick: () => regularForm(null) }, '+ New regular item'),
    list.length ? list.slice().sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1).map(r => h('div', { class: 'card tap', onclick: () => regularForm(r) },
      h('div', { class: 'row between' }, h('b', {}, r.title), h('span', { class: 'pill' + (r.auto ? ' type' : '') }, r.auto ? 'Automatic' : 'Suggested')),
      h('div', { class: 'small muted' }, daysText(r.days || []) + (r.time ? ' · ' + r.time : '') + (((r.exIds || []).length || r.sessionId) ? ' · adds training' : '')))) : h('div', { class: 'empty' }, 'Nothing regular yet.'));
};
function regularForm(existing) {
  const r = existing ? JSON.parse(JSON.stringify(existing)) : { id: PT.uid(), title: '', days: [], time: '', auto: false, exIds: [], sessionId: '' };
  r.exIds = r.exIds || [];
  const box = h('div', {}); const sh = PT.sheet(existing ? 'Edit regular item' : 'New regular item', box);
  let q = '';
  const draw = () => {
    const exRows = q ? PT.state.exercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8) : PT.state.exercises.filter(e => r.exIds.includes(e.id));
    PT.fill(box,
      PT.field('What', h('input', { value: r.title, placeholder: 'e.g. Progress photos, MMA class, AM stretch', oninput: e => r.title = e.target.value })), gap(10),
      h('label', { class: 'f' }, 'Which days'), PT.chips(DOW.map(([v, l]) => [v, l]), r.days, () => {}),
      h('button', { class: 'btn ghost small', onclick: () => { r.days = [0, 1, 2, 3, 4, 5, 6]; draw(); } }, 'Every day'), gap(10),
      PT.field('Time (optional)', h('input', { type: 'time', value: r.time || '', oninput: e => r.time = e.target.value })), gap(10),
      h('label', { class: 'f' }, 'How'), PT.seg([[true, 'Add automatically'], [false, 'Suggest only']], !!r.auto, v => r.auto = v), gap(12),
      h('label', { class: 'f' }, 'Adds training (optional)'),
      h('select', { onchange: e => r.sessionId = e.target.value }, h('option', { value: '' }, 'No saved session'), PT.state.sessions.map(s => h('option', { value: s.id, selected: s.id === r.sessionId }, s.name))), gap(8),
      h('input', { placeholder: 'or search exercises to add', value: q, oninput: e => { q = e.target.value.trim().toLowerCase(); draw(); } }),
      exRows.map(e => h('div', { class: 'card tap', style: { margin: '6px 0' }, onclick: () => { const i = r.exIds.indexOf(e.id); if (i >= 0) r.exIds.splice(i, 1); else r.exIds.push(e.id); draw(); } },
        h('div', { class: 'row between' }, h('b', {}, e.name), h('span', { class: r.exIds.includes(e.id) ? 'ok' : 'red', style: { fontWeight: 800 } }, r.exIds.includes(e.id) ? '✓' : '+')))), gap(12),
      h('button', { class: 'btn block', onclick: () => {
        r.title = r.title.trim(); if (!r.title) { PT.toast('Say what it is'); return; } if (!r.days.length) { PT.toast('Pick at least one day'); return; }
        const L = PT.state.regular, i = L.findIndex(x => x.id === r.id); if (i >= 0) L[i] = r; else L.push(r);
        PT.save(); sh.close(); PT.render();
      } }, 'Save'),
      existing ? h('button', { class: 'btn danger block', style: { marginTop: '8px' }, onclick: () => { PT.state.regular = PT.state.regular.filter(x => x.id !== r.id); PT.save(); sh.close(); PT.render(); } }, 'Delete') : null);
    const el = box.querySelector('input'); if (q && document.activeElement !== el) { const s = [...box.querySelectorAll('input')].find(i => i.placeholder.startsWith('or search')); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  };
  draw();
}

/* ---------- body & macros ---------- */
PT.moreViews.body = function () {
  const s = PT.state.settings; s.maxTargets = Object.assign({ kcal: '', p: '', c: '', f: '' }, PT.maxGoals ? PT.maxGoals() : s.maxTargets);
  const t = s.targets, m = s.maxTargets;
  const mid = h('div', { class: 'small muted', style: { marginTop: '6px' } });
  const updMid = () => {
    const half = k => num(m[k]) > num(t[k]) ? Math.round((num(t[k]) + num(m[k])) / 2) : num(t[k]);
    mid.textContent = num(t.kcal) ? 'One-session days sit halfway: about ' + half('kcal') + ' kcal · P ' + half('p') + ' · C ' + half('c') + ' · F ' + half('f') + '.' : '';
  };
  const row = (o, label) => h('div', { class: 'card' }, h('b', {}, label), h('div', { class: 'grid2', style: { marginTop: '8px' } },
    ...[['kcal', 'Calories'], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']].map(([k, l]) => PT.field(l, PT.numInput(o[k], v => { o[k] = v; PT.save(); updMid(); }, '', '1')))));
  updMid();
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Body & macros'),
    h('h2', {}, 'Body'),
    h('div', { class: 'card' }, h('div', { class: 'grid2' },
      PT.field('Body weight (kg)', PT.numInput(s.bodyKg, v => { s.bodyKg = v; PT.save(); }, '', '0.1')),
      PT.field('Height (cm)', PT.numInput(s.heightCm, v => { s.heightCm = v; PT.save(); }, '', '1')),
      PT.field('Age', PT.numInput(s.age, v => { s.age = v; PT.save(); }, '', '1')),
      PT.field('Body fat % (estimate)', h('input', { value: s.bodyFat || '', placeholder: 'e.g. 16–19', oninput: e => { s.bodyFat = e.target.value; PT.save(); } })))),
    h('h2', {}, 'Daily macro goals'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Rest days use the first set, days with two or more sessions the second. When you plan sessions on a day, its goals move accordingly; rating how hard the day was nudges them.'),
    row(t, 'Rest day (no sessions)'), row(m, 'Two or more sessions'), mid,
    h('p', { class: 'small muted' }, 'Research basis (ACSM / AND / DC 2016; ISSN): carbs rise with training load (about 3–5 g/kg light days, 5–7 g/kg ~1 h, 6–10 g/kg 1–3 h); protein 1.6–2.4 g/kg for recomposition; fat at least 20% of calories.'));
};

/* ---------- journal log (diary of what you logged on the Journal tab) ---------- */
PT.moreViews.journal = function () {
  const log = PT.state.journalLog = PT.state.journalLog || {};
  const dates = Object.keys(log).filter(d => (log[d] || []).length).sort().reverse();
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Journal log'),
    h('a', { class: 'btn ghost block', href: '#/journal', style: { marginBottom: '12px' } }, 'Write a new entry ›'),
    dates.length ? dates.map(d => h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('b', {}, PT.niceDate(d)), h('span', { class: 'small muted' }, log[d].length + (log[d].length === 1 ? ' entry' : ' entries'))),
      log[d].map(e => {
        const long = e.text.length > 240, body = h('div', { class: 'small', style: { whiteSpace: 'pre-wrap', marginTop: '6px' } }, long ? e.text.slice(0, 240).trim() + '…' : e.text);
        return h('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } },
          e.at ? h('div', { class: 'small muted' }, e.at) : null, body,
          h('div', { class: 'row', style: { marginTop: '4px' } },
            long ? h('button', { class: 'back small', style: { margin: 0, color: 'var(--red2)' }, onclick: ev => { body.textContent = e.text; ev.target.remove(); } }, 'Read all') : null,
            h('button', { class: 'back small', style: { margin: 0 }, onclick: () => PT.confirm('Delete this entry?', 'Delete', () => { log[d] = log[d].filter(x => x.id !== e.id); PT.save(); PT.render(); }) }, 'Delete')));
      }))) : h('div', { class: 'empty' }, 'Nothing logged yet. Write on the Journal tab and tap Log journal.'));
};

/* ---------- goals folder ----------
   state.goalAreas = [{ id, title, intro, current, items: [{ id, text, done }], later }] */
const goalOpen = {};
PT.moreViews.goals = function () {
  const areas = PT.state.goalAreas = PT.state.goalAreas || [];
  if (!areas.length) ['Athletic goals', 'Financial goals', 'Life goals'].forEach(t => areas.push({ id: PT.uid(), title: t, intro: '', current: '', items: [], later: '' }));
  const area = a => {
    const doneN = a.items.filter(i => i.done).length, nt = { v: '' };
    const det = h('details', { class: 'section', open: !!goalOpen[a.id] },
      h('summary', {}, h('div', { class: 'grow' }, h('div', { class: 'sec-title' }, a.title), h('div', { class: 'small muted' }, a.items.length ? doneN + ' of ' + a.items.length + ' done' : 'No goals yet')), h('span', { class: 'chev' })),
      h('div', { class: 'sec-body' },
        a.intro ? h('p', { class: 'small', style: { marginTop: 0 } }, a.intro) : null,
        a.current ? h('div', { class: 'small muted', style: { marginBottom: '6px' } }, h('b', {}, 'Now: '), a.current) : null,
        a.items.map(it => {
          const cb = h('input', { type: 'checkbox', checked: !!it.done }); cb.addEventListener('change', () => { it.done = cb.checked; PT.save(); PT.render(); });
          // details: write out exactly what you're trying to do, why, and how
          const more = h('div', { class: 'goal-detail', style: { display: goalOpen[it.id] ? '' : 'none' } },
            h('textarea', { value: it.detail || '', placeholder: 'What exactly am I aiming for, why it matters, how I\'ll get there, what done looks like…', oninput: e => { it.detail = e.target.value; PT.save(); } }));
          const toggle = h('button', { class: 'back small', style: { margin: '0 0 0 36px', color: 'var(--red2)' }, onclick: () => { goalOpen[it.id] = !goalOpen[it.id]; more.style.display = goalOpen[it.id] ? '' : 'none'; toggle.textContent = goalOpen[it.id] ? 'Hide details' : (it.detail ? 'Details ›' : '+ Add details'); } },
            goalOpen[it.id] ? 'Hide details' : (it.detail ? 'Details ›' : '+ Add details'));
          return h('div', { class: 'goal-item' },
            h('label', { class: 'checkrow' + (it.done ? ' done' : ''), style: { borderBottom: 0, paddingBottom: '2px' } }, cb, h('div', { class: 'grow t' }, it.text),
              h('button', { class: 'btn ghost small', 'aria-label': 'Remove', onclick: ev => { ev.preventDefault(); PT.confirm('Remove "' + it.text + '"?', 'Remove', () => { a.items = a.items.filter(x => x.id !== it.id); PT.save(); PT.render(); }); } }, '✕')),
            it.detail && !goalOpen[it.id] ? h('div', { class: 'small muted', style: { margin: '0 0 2px 36px' } }, it.detail.length > 90 ? it.detail.slice(0, 90) + '…' : it.detail) : null,
            toggle, more);
        }),
        h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'nowrap' } },
          h('input', { placeholder: 'Add a goal', oninput: e => nt.v = e.target.value }),
          h('button', { class: 'btn small', onclick: () => { if (!nt.v.trim()) return; a.items.push({ id: PT.uid(), text: nt.v.trim(), done: false }); PT.save(); PT.render(); } }, 'Add')),
        a.later ? h('div', { class: 'small muted', style: { marginTop: '10px', whiteSpace: 'pre-wrap' } }, h('b', {}, 'Later: '), a.later) : null,
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn ghost small', onclick: () => editArea(a) }, 'Edit'),
          h('button', { class: 'btn danger small', onclick: () => PT.confirm('Delete "' + a.title + '" and its goals?', 'Delete', () => { PT.state.goalAreas = areas.filter(x => x.id !== a.id); PT.save(); PT.render(); }) }, 'Delete'))));
    det.addEventListener('toggle', () => { goalOpen[a.id] = det.open; });
    return det;
  };
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Goals'),
    areas.map(area),
    h('button', { class: 'btn ghost block', onclick: () => editArea(null) }, '+ New goal area'));
};
function editArea(a) {
  const d = a ? Object.assign({}, a) : { id: PT.uid(), title: '', intro: '', current: '', items: [], later: '' };
  const sh = PT.sheet(a ? 'Edit goal area' : 'New goal area', h('div', {},
    PT.field('Name', h('input', { value: d.title, placeholder: 'e.g. Financial goals', oninput: e => d.title = e.target.value })), gap(8),
    PT.field('What it\'s about (optional)', h('textarea', { value: d.intro, oninput: e => d.intro = e.target.value })), gap(8),
    PT.field('Where you are now (optional)', h('textarea', { value: d.current, oninput: e => d.current = e.target.value })), gap(8),
    PT.field('Later on (optional)', h('textarea', { value: d.later, oninput: e => d.later = e.target.value })), gap(12),
    h('button', { class: 'btn block', onclick: () => {
      if (!d.title.trim()) { PT.toast('Name it first'); return; }
      const L = PT.state.goalAreas, i = L.findIndex(x => x.id === d.id); d.title = d.title.trim(); if (i >= 0) L[i] = d; else L.push(d);
      PT.save(); sh.close(); PT.render();
    } }, 'Save')));
}

/* ---------- setup import: adds a prepared bundle (exercises, sessions, goals…) without deleting anything ----------
   Format: { ptSetup: 1, settings, exercises, customStretches, links, routines, sessions, regular, goalAreas, foods, principles, quotes } */
PT.importSetup = o => {
  const st = PT.state, out = [];
  const byName = (list, n) => list.find(x => String(x.name || x.title || '').toLowerCase() === String(n).toLowerCase());
  if (o.settings) {
    const s = st.settings;
    ['bodyKg', 'heightCm', 'age', 'bodyFat'].forEach(k => { if (o.settings[k] != null) s[k] = o.settings[k]; });
    if (o.settings.targets) s.targets = Object.assign({}, s.targets, o.settings.targets);
    if (o.settings.maxTargets) { s.maxTargets = Object.assign({}, o.settings.maxTargets); s.hardKcal = ''; }
    (o.settings.shiftPresets || []).forEach(p => { s.shiftPresets = s.shiftPresets || []; if (!s.shiftPresets.some(x => x.start === p.start && x.end === p.end)) s.shiftPresets.push(p); });
    out.push('body, macro goals and shifts');
  }
  let n = 0;
  (o.customStretches || []).forEach(x => { if (!st.customStretches.some(c => c.id === x.id)) { st.customStretches.push(x); n++; } });
  if (n) out.push(n + ' warm-ups/stretches');
  n = 0; const exId = {};
  (o.exercises || []).forEach(x => { let e = byName(st.exercises, x.name); if (!e) { e = Object.assign({ id: PT.uid(), notes: '', link: '' }, x); st.exercises.push(e); n++; } exId[x.name.toLowerCase()] = e.id; });
  st.exercises.forEach(e => exId[e.name.toLowerCase()] = e.id);
  if (n) out.push(n + ' exercises');
  (o.links || []).forEach(l => { const e = st.exercises.find(x => x.id === exId[l.exercise.toLowerCase()]); if (!e) return; e.stretches = e.stretches || { before: [], after: [] };
    ['before', 'after'].forEach(ph => (l[ph] || []).forEach(id => { e.stretches[ph] = e.stretches[ph] || []; if (!e.stretches[ph].includes(id)) e.stretches[ph].push(id); })); });
  if ((o.links || []).length) out.push('linked stretches');
  n = 0; (o.routines || []).forEach(r => { if (!byName(st.routines, r.name)) { st.routines.push(Object.assign({ id: PT.uid() }, r)); n++; } }); if (n) out.push(n + ' recovery routines');
  n = 0; const sesId = {};
  (o.sessions || []).forEach(s => {
    let ex = byName(st.sessions, s.name);
    if (!ex) { ex = { id: PT.uid(), name: s.name, type: s.type || 'other', tags: s.tags || [], exercises: s.exercises.map(x => ({ id: PT.uid(), exId: exId[x.name.toLowerCase()] || '', name: x.name, kind: x.kind || ((st.exercises.find(e => e.id === exId[x.name.toLowerCase()]) || {}).kind) || 'strength', level: 7, plan: x.plan })) }; st.sessions.push(ex); n++; }
    sesId[s.name.toLowerCase()] = ex.id;
  });
  if (n) out.push(n + ' saved sessions');
  n = 0; (o.regular || []).forEach(r => { if (!byName(st.regular, r.title)) { st.regular.push({ id: PT.uid(), title: r.title, days: r.days, time: r.time || '', auto: !!r.auto,
    exIds: (r.exercises || []).map(x => exId[x.toLowerCase()]).filter(Boolean), sessionId: r.session ? sesId[r.session.toLowerCase()] || '' : '' }); n++; } }); if (n) out.push(n + ' regular items');
  n = 0; (o.goalAreas || []).forEach(a => { const ex = byName(st.goalAreas, a.title); if (ex && !ex.items.length && !ex.intro) { st.goalAreas = st.goalAreas.filter(x => x !== ex); } if (!byName(st.goalAreas, a.title)) { st.goalAreas.push(Object.assign({ id: PT.uid() }, a, { items: (a.items || []).map(t => ({ id: PT.uid(), text: t, done: false })) })); n++; } }); if (n) out.push(n + ' goal areas');
  n = 0; (o.foods || []).forEach(f => { if (!byName(st.foods, f.name)) { st.foods.push(Object.assign({ id: PT.uid() }, f)); n++; } }); if (n) out.push(n + ' foods');
  if (o.principles && !(st.principles || '').includes(o.principles.slice(0, 40))) { st.principles = st.principles ? st.principles + '\n\n' + o.principles : o.principles; out.push('your principles'); }
  n = 0; (o.quotes || []).forEach(q => { if (!st.quotes.some(x => x.text === q.text)) { st.quotes.push(Object.assign({ id: PT.uid() }, q)); n++; } }); if (n) out.push(n + ' quotes');
  PT.save();
  return out;
};
PT.setupSheet = () => {
  let text = '';
  const area = h('textarea', { placeholder: 'Paste the setup text here, or choose the file', oninput: e => text = e.target.value });
  const file = h('input', { type: 'file', accept: '.json,application/json,text/plain' });
  file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { text = String(r.result); area.value = text; }; r.readAsText(f); });
  const sh = PT.sheet('Import setup', h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Adds a prepared set of exercises, sessions, goals and more. Nothing you already have is deleted or changed, apart from body details and macro goals if the file includes them.'),
    file, gap(10), area, gap(12),
    h('button', { class: 'btn block', onclick: () => {
      let o; try { o = JSON.parse(text); } catch (e) { PT.toast('That is not a valid setup file'); return; }
      if (!o || !o.ptSetup) { PT.toast('That does not look like a PT setup file'); return; }
      const out = PT.importSetup(o); sh.close();
      PT.sheet('Imported', h('div', {}, h('p', { style: { marginTop: 0 } }, out.length ? 'Added: ' + out.join(', ') + '.' : 'Everything in that file was already in your app.'), h('button', { class: 'btn block', onclick: () => { document.getElementById('modal').replaceChildren(); document.body.classList.remove('noscroll'); PT.render(); } }, 'Done')));
    } }, 'Import')));
  return sh;
};
})();
