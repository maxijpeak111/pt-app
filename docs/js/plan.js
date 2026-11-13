(function () {
'use strict';
const PT = window.PT, h = PT.h;
let anchor = null; // Monday of the week being viewed

function ensureDay(date) {
  const p = PT.state.plan;
  if (!p[date]) p[date] = { items: [], shift: null, note: '' };
  if (!p[date].items) p[date].items = [];
  return p[date];
}
PT.ensureDay = ensureDay;
PT.dayTags = date => {
  const d = PT.state.plan[date]; if (!d) return [];
  const tags = new Set();
  (d.items || []).forEach(it => { const s = PT.session(it.sessionId); if (s) s.tags.forEach(t => tags.add(t)); });
  return [...tags];
};
PT.dayFuel = date => PT.sumMacros(PT.state.foodLog[date] || []);

PT.views.plan = function (parts) { return parts[1] ? dayView(parts[1]) : weekView(); };
PT.views.log = function (parts) { return logView(parts[1], parts[2]); };

/* ---------- week ---------- */
function weekView() {
  if (!anchor) anchor = PT.weekStart(PT.today());
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => PT.addDays(anchor, i));
  const items = days.flatMap(d => (PT.state.plan[d] || {}).items || []);
  const done = items.filter(i => i.logId).length;
  const q = PT.todayQuote();
  return h('div', {},
    h('h1', {}, 'Plan'),
    q ? h('div', { class: 'quote' }, '“' + q.text + '”', q.by ? h('small', {}, q.by) : null) : null,
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.addDays(anchor, -7); PT.render(); } }, '‹'),
      h('div', { class: 'week-title' }, PT.niceDate(days[0]) + ' – ' + PT.niceDate(days[6]),
        h('div', { class: 'small muted' }, items.length ? done + ' of ' + items.length + ' sessions logged' : 'No sessions planned')),
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.addDays(anchor, 7); PT.render(); } }, '›')),
    days.map(dayCard),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.weekStart(PT.today()); PT.render(); } }, 'This week'),
      h('button', { class: 'btn ghost small', onclick: copyShifts }, 'Copy last week’s shifts')),
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => PT.importSheet() }, 'Import calendar'));
}

function dayCard(date) {
  const day = PT.state.plan[date] || {}, items = day.items || [];
  const fuel = PT.dayFuel(date), rec = PT.state.recoveryLog[date] || {};
  return h('a', { class: 'card tap' + (date === PT.today() ? ' today' : ''), href: '#/plan/' + date },
    h('div', { class: 'day-head' }, h('div', { class: 'day-name' }, PT.dayName(date)), h('div', { class: 'day-date' }, PT.niceDate(date))),
    day.shift ? h('span', { class: 'pill shift' }, 'Shift ' + day.shift.start + '–' + day.shift.end + (day.shift.label ? ' · ' + day.shift.label : '')) : h('span', { class: 'pill' }, 'No shift'),
    (day.events || []).map(ev => h('span', { class: 'pill' }, PT.eventsText(ev))),
    items.map(it => { const s = PT.session(it.sessionId); return h('span', { class: 'pill ' + (it.logId ? 'done' : 'type') }, (s ? s.name : 'Deleted session') + ' · ' + it.intensity + (it.logId ? ' ✓' : '')); }),
    !items.length ? h('div', { class: 'muted small' }, 'Nothing planned') : null,
    (fuel.kcal || rec.sauna || rec.bike || rec.walk) ? h('div', { class: 'small muted', style: { marginTop: '4px' } },
      [fuel.kcal ? Math.round(fuel.kcal) + ' kcal' : null, rec.sauna ? 'sauna ' + rec.sauna + 'm' : null, rec.bike ? 'bike ' + rec.bike + 'm' : null, rec.walk ? 'walk ' + rec.walk + 'm' : null].filter(Boolean).join(' · ')) : null);
}

function copyShifts() {
  const prev = PT.addDays(anchor, -7); let n = 0;
  for (let i = 0; i < 7; i++) {
    const src = (PT.state.plan[PT.addDays(prev, i)] || {}).shift;
    const to = PT.addDays(anchor, i);
    if (src && !((PT.state.plan[to] || {}).shift)) { ensureDay(to).shift = Object.assign({}, src); n++; }
  }
  PT.save(); PT.toast(n ? 'Copied ' + n + ' shifts' : 'Nothing to copy'); PT.render();
}

/* ---------- day ---------- */
function dayView(date) {
  const day = PT.state.plan[date] || { items: [], shift: null, note: '' };
  const root = h('div', {});
  const shift = day.shift ? Object.assign({}, day.shift) : { label: '', start: '09:00', end: '17:00' };

  root.append(PT.back('#/plan', 'Week'), h('h1', {}, PT.niceDate(date)));

  // shift
  root.append(h('h2', {}, 'Work shift'),
    h('div', { class: 'card' },
      h('div', { class: 'grid2' },
        PT.field('Start', h('input', { type: 'time', value: shift.start, oninput: e => shift.start = e.target.value })),
        PT.field('End', h('input', { type: 'time', value: shift.end, oninput: e => shift.end = e.target.value }))),
      h('div', { style: { margin: '8px 0' } }, PT.field('Label (optional)', h('input', { placeholder: 'e.g. Early, Late, Gym floor', value: shift.label || '', oninput: e => shift.label = e.target.value }))),
      h('div', { class: 'row' },
        h('button', { class: 'btn small grow', onclick: () => { ensureDay(date).shift = Object.assign({}, shift); PT.save(); PT.toast('Shift saved'); PT.render(); } }, day.shift ? 'Update shift' : 'Save shift'),
        day.shift ? h('button', { class: 'btn danger small', onclick: () => { ensureDay(date).shift = null; PT.save(); PT.render(); } }, 'Clear') : null)));

  // other calendar events
  const evs = day.events || [], ne = { title: '', start: '', end: '' };
  root.append(h('h2', {}, 'Calendar'),
    evs.length ? h('div', {}, evs.map(ev => h('div', { class: 'card row between' }, h('div', {}, PT.eventsText(ev)),
      h('button', { class: 'btn danger small', onclick: () => { ensureDay(date).events = evs.filter(x => x.id !== ev.id); PT.save(); PT.render(); } }, 'Delete')))) : h('div', { class: 'empty' }, 'No other events. Import your calendar from the Plan tab, or add one here.'),
    h('details', {}, h('summary', {}, '+ Add event'),
      h('div', { class: 'card' },
        PT.field('What', h('input', { placeholder: 'e.g. Physio, dinner with Aiden', oninput: e => ne.title = e.target.value })),
        h('div', { class: 'grid2', style: { margin: '8px 0' } },
          PT.field('Start (optional)', h('input', { type: 'time', oninput: e => ne.start = e.target.value })),
          PT.field('End (optional)', h('input', { type: 'time', oninput: e => ne.end = e.target.value }))),
        h('button', { class: 'btn small block', onclick: () => {
          if (!ne.title.trim()) { PT.toast('Write what it is first'); return; }
          const d = ensureDay(date); d.events = (d.events || []).concat({ id: PT.uid(), title: ne.title.trim(), start: ne.start, end: ne.end });
          d.events.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1); PT.save(); PT.render();
        } }, 'Add event'))));

  // sessions
  root.append(h('h2', {}, day.items.length > 1 ? 'Combined day · ' + day.items.length + ' sessions' : 'Sessions'));
  if (!day.items.length) root.append(h('div', { class: 'empty' }, PT.state.sessions.length ? 'Nothing planned. Add a session below.' : 'You have no saved sessions yet. Build one in the Sessions tab first.'));
  day.items.forEach(it => root.append(itemCard(date, it)));
  root.append(h('button', { class: 'btn ghost block', onclick: () => addSheet(date) }, '+ Add session'));

  // recovery
  const tags = PT.dayTags(date);
  root.append(h('h2', {}, 'Recovery'),
    tags.length ? PT.stretchBlock(date, tags) : h('div', { class: 'empty' }, 'Add a session to get stretches matched to it, or pick areas on the Recover tab.'),
    PT.activityBlock(date));

  // fuel
  const f = PT.dayFuel(date), t = PT.state.settings.targets;
  root.append(h('h2', {}, 'Fuel'),
    h('a', { class: 'card tap', href: '#/fuel/' + date },
      h('div', { class: 'row between' }, h('div', { class: 'stat' }, Math.round(f.kcal) + (+t.kcal ? ' / ' + t.kcal : '') + ' kcal'), h('span', { class: 'red' }, '›')),
      h('div', { class: 'small muted' }, 'P ' + Math.round(f.p) + 'g · C ' + Math.round(f.c) + 'g · F ' + Math.round(f.f) + 'g')));

  // note
  root.append(h('h2', {}, 'Day note'),
    h('textarea', { placeholder: 'How today is shaping up, what to remember…', value: day.note || '', onchange: e => { ensureDay(date).note = e.target.value; PT.save(); } }));
  return root;
}

function itemCard(date, it) {
  const s = PT.session(it.sessionId);
  if (!s) return h('div', { class: 'card' }, h('p', {}, 'This session was deleted.'),
    h('button', { class: 'btn danger small', onclick: () => removeItem(date, it) }, 'Remove'));
  const label = h('span', { class: 'red', style: { fontWeight: '800' } });
  const list = h('ul', { class: 'plain' });
  function refresh() {
    label.textContent = 'Intensity ' + it.intensity + '/10 · ' + PT.pct(it.intensity) + '% of base';
    list.replaceChildren(...s.exercises.map(e => { const x = PT.scaleEx(e, it.intensity); return h('li', {}, h('b', {}, e.name), ' · ', PT.exText(x)); }));
  }
  const slider = h('input', { type: 'range', min: 1, max: 10, step: 1, value: it.intensity });
  slider.addEventListener('input', () => { it.intensity = +slider.value; refresh(); });
  slider.addEventListener('change', () => { ensureDay(date).items.find(x => x.id === it.id).intensity = it.intensity; PT.save(); });
  refresh();
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h3', {}, s.name), h('span', { class: 'pill type' }, PT.typeLabel(s.type))),
    h('div', { style: { marginTop: '8px' } }, label, slider),
    h('details', {}, h('summary', {}, 'Planned exercises (' + s.exercises.length + ')'), list),
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('a', { class: 'btn small grow', href: '#/log/' + date + '/' + it.id }, it.logId ? 'Edit log ✓' : 'Log this session'),
      h('button', { class: 'btn danger small', onclick: () => removeItem(date, it) }, 'Remove')));
}

function removeItem(date, it) {
  const run = () => {
    const d = ensureDay(date); d.items = d.items.filter(x => x.id !== it.id);
    if (it.logId) PT.state.logs = PT.state.logs.filter(l => l.id !== it.logId);
    PT.save(); PT.render();
  };
  if (it.logId) PT.confirm('This session has a log. Removing it also deletes that log.', 'Remove', run); else run();
}

function addSheet(date) {
  if (!PT.state.sessions.length) { PT.toast('Build a session first'); return; }
  const sh = PT.sheet('Add to ' + PT.niceDate(date), h('div', {},
    h('p', { class: 'muted small' }, 'Tap to add. Add two or more for a combined day (e.g. weights + swim).'),
    PT.state.sessions.map(s => h('div', { class: 'card tap', onclick: () => {
      ensureDay(date).items.push({ id: PT.uid(), sessionId: s.id, intensity: 7, logId: null });
      PT.save(); PT.toast('Added ' + s.name); PT.render();
    } }, h('div', { class: 'row between' }, h('b', {}, s.name), h('span', { class: 'pill' }, PT.typeLabel(s.type)))
    )),
    h('button', { class: 'btn ghost block', onclick: () => sh.close() }, 'Done')));
}

/* ---------- log a session ---------- */
function logView(date, itemId) {
  const day = PT.state.plan[date];
  const it = day && day.items.find(x => x.id === itemId);
  const s = it && PT.session(it.sessionId);
  if (!it || !s) return h('div', {}, PT.back('#/plan/' + date), h('div', { class: 'empty' }, 'That session could not be found.'));
  const existing = it.logId && PT.state.logs.find(l => l.id === it.logId);
  const rows = existing ? JSON.parse(JSON.stringify(existing.exercises)) : s.exercises.map(e => PT.scaleEx(e, it.intensity));
  const meta = { rpe: existing ? existing.rpe : '', notes: existing ? existing.notes : '' };
  const root = h('div', {}, PT.back('#/plan/' + date), h('h1', {}, 'Log: ' + s.name),
    h('p', { class: 'muted small' }, 'Prefilled with today’s targets at intensity ' + it.intensity + '. Change anything you did differently.'));
  rows.forEach(ex => {
    const fields = ex.kind === 'cardio'
      ? h('div', { class: 'grid3' },
          PT.field('Distance (' + ex.unit + ')', PT.numInput(ex.distance, v => ex.distance = v)),
          PT.field('Time', PT.durInput(ex.time, v => ex.time = v, 'h:mm:ss')),
          PT.field('Pace', PT.durInput(ex.pace, v => ex.pace = v)))
      : h('div', { class: 'grid3' },
          PT.field('Sets', PT.numInput(ex.sets, v => ex.sets = v)),
          PT.field('Reps', PT.numInput(ex.reps, v => ex.reps = v)),
          PT.field('Kg', PT.numInput(ex.kg, v => ex.kg = v)));
    root.append(h('div', { class: 'card' }, h('h3', { style: { marginBottom: '8px' } }, ex.name), fields));
  });
  root.append(h('div', { class: 'card' },
    PT.field('How hard did it feel? (1–10)', PT.numInput(meta.rpe, v => meta.rpe = v, '', '1')),
    h('div', { style: { height: '8px' } }),
    PT.field('Notes', h('textarea', { value: meta.notes || '', oninput: e => meta.notes = e.target.value }))));
  root.append(h('button', { class: 'btn block', onclick: () => {
    rows.forEach(ex => { // fill in pace/time if one is missing
      if (ex.kind === 'cardio' && +ex.distance) {
        const per = ex.unit === 'm' ? ex.distance / 100 : ex.distance;
        if (!+ex.pace && +ex.time) ex.pace = Math.round(ex.time / per);
        if (!+ex.time && +ex.pace) ex.time = Math.round(ex.pace * per);
      }
    });
    const entry = { id: existing ? existing.id : PT.uid(), date, sessionId: s.id, name: s.name, type: s.type, intensity: it.intensity, rpe: meta.rpe, notes: meta.notes, exercises: rows };
    if (existing) PT.state.logs[PT.state.logs.findIndex(l => l.id === existing.id)] = entry; else PT.state.logs.push(entry);
    it.logId = entry.id; PT.save(); PT.toast('Logged'); location.hash = '#/plan/' + date;
  } }, existing ? 'Save changes' : 'Save log'));
  return root;
}
})();
