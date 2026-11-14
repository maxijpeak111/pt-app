(function () {
'use strict';
const PT = window.PT, h = PT.h;
let anchor = null; // Monday of the week being viewed

function ensureDay(date) {
  const p = PT.state.plan;
  if (!p[date]) p[date] = { exs: [], shift: null, note: '' };
  if (!p[date].exs) p[date].exs = [];
  return p[date];
}
PT.ensureDay = ensureDay;
// Folders (muscles / sports) of everything on a day, used to match stretches.
PT.dayTags = date => {
  const tags = new Set();
  PT.dayExs(date).forEach(en => { const lib = PT.libEx(en); ((lib && lib.muscles) || (en.kind === 'laps' ? ['swim'] : [])).forEach(t => tags.add(t)); });
  return [...tags];
};
PT.dayFuel = date => PT.sumMacros(PT.state.foodLog[date] || []);

PT.views.plan = function (parts) { return parts[1] ? dayView(parts[1]) : weekView(); };
PT.views.log = function (parts) { return dayView(parts[1]); }; // old links to a session log now open the day

/* ---------- week ---------- */
function weekView() {
  if (!anchor) anchor = PT.weekStart(PT.today());
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => PT.addDays(anchor, i));
  const trained = days.filter(d => PT.dayExs(d).some(PT.hasActual)).length;
  const planned = days.filter(d => PT.dayExs(d).length).length;
  const q = PT.todayQuote();
  return h('div', {},
    h('h1', {}, 'Plan'),
    q ? h('div', { class: 'quote' }, '“' + q.text + '”', q.by ? h('small', {}, q.by) : null) : null,
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.addDays(anchor, -7); PT.render(); } }, '‹'),
      h('div', { class: 'week-title' }, PT.niceDate(days[0]) + ' – ' + PT.niceDate(days[6]),
        h('div', { class: 'small muted' }, planned ? trained + ' of ' + planned + ' training days logged' : 'Nothing planned yet')),
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.addDays(anchor, 7); PT.render(); } }, '›')),
    days.map(dayCard),
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.weekStart(PT.today()); PT.render(); } }, 'This week'),
      h('button', { class: 'btn ghost small', onclick: copyShifts }, 'Copy last week’s shifts')),
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => PT.importSheet() }, 'Import calendar'));
}

function dayCard(date) {
  const day = PT.state.plan[date] || {}, exs = day.exs || [];
  const fuel = PT.dayFuel(date), rec = PT.state.recoveryLog[date] || {};
  return h('a', { class: 'card tap' + (date === PT.today() ? ' today' : ''), href: '#/plan/' + date },
    h('div', { class: 'day-head' }, h('div', { class: 'day-name' }, PT.dayName(date)), h('div', { class: 'day-date' }, PT.niceDate(date))),
    day.shift ? h('span', { class: 'pill shift' }, 'Shift ' + day.shift.start + '–' + day.shift.end + (day.shift.label ? ' · ' + day.shift.label : '')) : h('span', { class: 'pill' }, 'No shift'),
    (day.events || []).map(ev => h('span', { class: 'pill' }, PT.eventsText(ev))),
    exs.slice(0, 6).map(en => h('span', { class: 'pill ' + (PT.hasActual(en) ? 'done' : 'type') }, en.name + (PT.hasActual(en) ? ' ✓' : ''))),
    exs.length > 6 ? h('span', { class: 'pill' }, '+' + (exs.length - 6) + ' more') : null,
    !exs.length ? h('div', { class: 'muted small' }, 'Nothing planned') : null,
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


/* ---------- day: before → exercises → after, then the rest of the day ---------- */
const openState = {}; // remembers if the Intensity dropdown is open while you work on a day
const gap = px => h('div', { style: { height: px + 'px' } });

function dayView(date) {
  const day = PT.state.plan[date] || {};
  const isToday = date === PT.today();
  const root = h('div', {}, PT.back('#/plan', 'Week'), h('h1', {}, isToday ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)));

  // training: everything that changes when exercises are added lives in `train` and is redrawn together
  const train = h('div', {});
  const redraw = () => PT.fill(train, training(date, redraw));
  redraw();
  root.append(train);

  root.append(gap(10), PT.activityBlock(date));

  // fuel
  const f = PT.dayFuel(date), t = PT.dayTargets(date);
  root.append(h('h2', {}, 'Fuel'),
    h('a', { class: 'card tap', href: '#/fuel/' + date },
      h('div', { class: 'row between' }, h('div', { class: 'stat' }, Math.round(f.kcal) + (t.kcal ? ' / ' + t.kcal : '') + ' kcal'), h('span', { class: 'red' }, '›')),
      h('div', { class: 'small muted' }, 'P ' + Math.round(f.p) + 'g · C ' + Math.round(f.c) + 'g · F ' + Math.round(f.f) + 'g')));

  // shift
  const shift = day.shift ? Object.assign({}, day.shift) : { label: '', start: '09:00', end: '17:00' };
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
        PT.field('What', h('input', { placeholder: 'e.g. Physio, dinner with a friend', oninput: e => ne.title = e.target.value })),
        h('div', { class: 'grid2', style: { margin: '8px 0' } },
          PT.field('Start (optional)', h('input', { type: 'time', oninput: e => ne.start = e.target.value })),
          PT.field('End (optional)', h('input', { type: 'time', oninput: e => ne.end = e.target.value }))),
        h('button', { class: 'btn small block', onclick: () => {
          if (!ne.title.trim()) { PT.toast('Write what it is first'); return; }
          const d = ensureDay(date); d.events = (d.events || []).concat({ id: PT.uid(), title: ne.title.trim(), start: ne.start, end: ne.end });
          d.events.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1); PT.save(); PT.render();
        } }, 'Add event'))));

  // note
  root.append(h('h2', {}, 'Day note'),
    h('textarea', { placeholder: 'How today went, what to remember…', value: day.note || '', onchange: e => { ensureDay(date).note = e.target.value; PT.save(); } }));
  return root;
}

function training(date, redraw) {
  const exs = PT.dayExs(date), tags = PT.dayTags(date);
  const logged = exs.filter(PT.hasActual).length;
  return [
    PT.stretchBlock(date, tags, 'before', true),
    h('h2', {}, exs.length ? 'Exercises · ' + logged + '/' + exs.length + ' logged' : 'Exercises'),
    exs.length ? exs.map(en => entryCard(date, en, redraw)) : h('div', { class: 'empty' }, 'Nothing yet. Tap Add exercises and pick from the folders: Chest, Back, Legs, Swim, Run…'),
    h('button', { class: 'btn block', onclick: () => addExercises(date, redraw) }, '+ Add exercises'),
    exs.length ? intensityBox(date, redraw) : null,
    exs.length ? effortBox(date) : null,
    gap(16),
    PT.stretchBlock(date, tags, 'after', true)
  ];
}

function addExercises(date, redraw) {
  PT.browseSheet((list, fromSession) => {
    const d = ensureDay(date);
    list.forEach(x => d.exs.push(PT.makeEntry(x, fromSession ? { fromSession: fromSession.id } : null)));
    PT.save(); redraw();
  }, { onStretch: (id, phase) => { PT.addDayStretch(date, id, phase); redraw(); } });
}

// One exercise: the target (a guide) and what you actually did (what counts).
function entryCard(date, en, redraw) {
  const t = PT.entryTarget(en), last = PT.lastDone(en, date), lib = PT.libEx(en);
  const a = en.actual || {};
  const pill = h('span', { class: 'pill done' }, '✓ logged');
  const extra = h('div', { class: 'small muted', style: { marginTop: '6px' } });
  function status() {
    pill.style.display = PT.hasActual(en) ? '' : 'none';
    let txt = '';
    if (en.kind === 'laps' && +a.laps) txt = '= ' + (+a.sets || 1) * a.laps * PT.pool() + ' m (' + PT.pool() + ' m pool)';
    if (en.kind === 'cardio' && +a.distance && +a.time) txt = 'Pace ' + PT.fmtDur(Math.round(a.time / (en.unit === 'm' ? a.distance / 100 : a.distance))) + (en.unit === 'm' ? ' /100m' : ' /km');
    extra.textContent = txt;
  }
  const save = () => { en.actual = a; PT.syncDayLog(date); PT.save(); status(); };
  const tv = k => t && t[k] !== '' && t[k] != null && +t[k] ? t[k] : '';
  const num = (k, label, step) => PT.field(label, PT.numInput(a[k], v => { a[k] = v; save(); }, String(tv(k)), step));
  const dur = (k, label, ph) => PT.field(label, PT.durInput(a[k], v => { a[k] = v; save(); }, tv(k) ? PT.fmtDur(tv(k)) : ph));
  const fields = en.kind === 'laps' ? h('div', { class: 'grid3' }, num('sets', 'Sets', '1'), num('laps', 'Laps', '1'), dur('time', 'Time', 'm:ss'))
    : en.kind === 'cardio' ? h('div', { class: 'grid2' }, num('distance', 'Distance (' + (en.unit || 'km') + ')'), dur('time', 'Time', 'h:mm:ss'))
    : en.kind === 'time' ? h('div', { class: 'grid2' }, num('rounds', 'Rounds', '1'), dur('time', 'Time per round', 'm:ss'))
    : h('div', { class: 'grid3' }, num('sets', 'Sets', '1'), num('reps', 'Reps', '1'), num('kg', 'Kg', '0.5'));
  const el = h('div', { class: 'card' },
    h('div', { class: 'row between', style: { flexWrap: 'nowrap' } },
      h('h3', { class: 'grow' }, en.name),
      pill,
      h('button', { class: 'btn ghost small', 'aria-label': 'Remove ' + en.name, onclick: () => {
        const go = () => { const d = ensureDay(date); d.exs = d.exs.filter(x => x.id !== en.id); PT.syncDayLog(date); PT.save(); redraw(); };
        if (PT.hasActual(en)) PT.confirm('Remove ' + en.name + ' and what you logged for it?', 'Remove', go); else go();
      } }, '✕')),
    t ? h('div', { class: 'small', style: { marginTop: '4px' } }, h('span', { class: 'muted' }, 'Target · L' + (en.level || 7) + '  '), PT.exText(t))
      : h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'No target. ',
          lib ? h('button', { class: 'back small', style: { color: 'var(--red2)', margin: 0 }, onclick: () => {
            const box = h('div', {}); const sh = PT.sheet('Min / max: ' + lib.name, box);
            PT.rangeForm(box, lib, () => { sh.close(); redraw(); });
          } }, 'Set min/max (optional)') : null),
    last ? h('div', { class: 'small muted' }, 'Last time (' + PT.niceDate(last.date) + '): ' + PT.exText(Object.assign({ kind: en.kind, unit: en.unit }, last.ex))) : null,
    gap(8), h('label', { class: 'f', style: { color: 'var(--red2)' } }, 'What you did'), fields, extra,
    t ? h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => {
      (PT.FIELDS[en.kind] || []).forEach(k => { if (tv(k)) a[k] = t[k]; });
      save(); el.replaceWith(entryCard(date, en, redraw)); PT.toast('Filled in the target');
    } }, 'Did the target ✓') : null);
  status();
  return el;
}

// Intensity: tucked away. Changes the suggested targets only.
function intensityBox(date, redraw) {
  const exs = PT.dayExs(date);
  const lv = PT.dayLevel(date);
  const label = h('span', {}, 'Set all to level ' + lv);
  const slider = h('input', { type: 'range', min: 1, max: 10, step: 1, value: lv });
  slider.addEventListener('input', () => { label.textContent = 'Set all to level ' + slider.value; });
  slider.addEventListener('change', () => { exs.forEach(e => e.level = +slider.value); PT.syncDayLog(date); PT.save(); redraw(); });
  const clamp = v => Math.min(10, Math.max(1, v));
  const det = h('details', { open: !!openState[date] },
    h('summary', {}, 'Intensity · level ' + lv + '/10'),
    h('p', { class: 'small muted' }, 'Only changes the suggested targets. Exercises without a min/max have none.'),
    h('div', { class: 'red', style: { fontWeight: 800 } }, label), slider,
    h('div', { class: 'row between small muted' }, h('span', {}, 'Easy day'), h('span', {}, 'Feeling strong')),
    exs.map(en => {
      const t = PT.entryTarget(en);
      const step = d => { en.level = clamp((en.level || 7) + d); PT.syncDayLog(date); PT.save(); redraw(); };
      return h('div', { class: 'stepper' },
        h('button', { class: 'btn ghost small', onclick: () => step(-1) }, '−'),
        h('div', { class: 'grow' }, h('b', {}, en.name), h('span', { class: 'red small' }, '  L' + (en.level || 7)), h('div', { class: 'small muted' }, t ? PT.exText(t) : 'no min/max set')),
        h('button', { class: 'btn ghost small', onclick: () => step(1) }, '+'));
    }));
  det.addEventListener('toggle', () => { openState[date] = det.open; });
  return h('div', { class: 'card', style: { marginTop: '10px' } }, det);
}

function effortBox(date) {
  const day = PT.state.plan[date] || {};
  const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]);
  return h('div', { class: 'card', style: { marginTop: '10px' } },
    h('label', { class: 'f' }, 'How hard did today feel? (1 easy – 10 max)'),
    (() => { const sg = PT.seg(opts, +day.rpe || 0, v => { ensureDay(date).rpe = v; PT.syncDayLog(date); PT.save(); }); sg.classList.add('tight'); return sg; })());
}
})();
