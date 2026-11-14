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
    PT.backupNudge ? PT.backupNudge() : null,
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

// One day in the week list, as plain lines: shift, training, reminders.
function dayCard(date) {
  const day = PT.state.plan[date] || {}, exs = day.exs || [];
  const title = PT.dayTitle(date), done = exs.filter(PT.hasActual).length;
  const rems = PT.remindersFor(date);
  return h('a', { class: 'card tap' + (date === PT.today() ? ' today' : ''), href: '#/plan/' + date },
    h('div', { class: 'day-head' }, h('div', { class: 'day-name' }, PT.dayName(date)), h('div', { class: 'day-date' }, PT.niceDate(date))),
    h('div', { class: 'day-line' + (day.shift ? '' : ' muted') }, PT.shiftText(day.shift)),
    title ? h('div', { class: 'day-line' }, h('b', {}, title), done ? h('span', { class: done === exs.length ? 'ok' : 'muted' }, ' · ' + (done === exs.length ? 'done ✓' : done + ' of ' + exs.length + ' done')) : null)
      : h('div', { class: 'day-line muted' }, 'Rest day'),
    rems.map(r => h('div', { class: 'day-line rem' }, h('b', {}, 'Reminder: '), r.text)));
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

/* ---------- notes that mention another day ---------- */
const WD = { sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, saturday: 6 };
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MONRX = '(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*';
// Dates a piece of text talks about, worked out from the day it was written on (base).
PT.datesIn = (text, base) => {
  const out = new Set(), days = new Set(), t = ' ' + String(text).toLowerCase() + ' ';
  const b = PT.parse(base);
  const ymd = (y, m, d) => { const x = new Date(y, m, d); return x.getMonth() === m ? PT.dstr(x) : null; };
  const future = (m, d) => { let s = ymd(b.getFullYear(), m, d); if (s && s <= base) s = ymd(b.getFullYear() + 1, m, d); return s; };
  if (/\btomorrow\b/.test(t)) out.add(PT.addDays(base, 1));
  // weekday names → the next one after the day you wrote it ("Sat" only with a capital, so "I sat down" doesn't count)
  for (const m of t.matchAll(/\b(sunday|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday)\b/g)) {
    const diff = ((WD[m[1]] - b.getDay()) + 7) % 7 || 7; days.add(PT.addDays(base, diff));
  }
  if (/\bSat\b/.test(text)) days.add(PT.addDays(base, ((6 - b.getDay()) + 7) % 7 || 7));
  const usedNums = new Set();
  for (const m of t.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?' + MONRX + '\\b', 'g'))) { const s2 = future(MON[m[2]], +m[1]); if (s2) out.add(s2); usedNums.add(m.index); }
  for (const m of t.matchAll(new RegExp('\\b' + MONRX + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b', 'g'))) { const s2 = future(MON[m[1]], +m[2]); if (s2) out.add(s2); }
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)) { const s2 = future(+m[2] - 1, +m[1]); if (s2) out.add(s2); }
  // "the 18th" on its own → the next 18th
  for (const m of t.matchAll(/\b(\d{1,2})(st|nd|rd|th)\b(?!\s*(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/g)) {
    const d = +m[1]; if (d < 1 || d > 31) continue;
    for (let k = 1; k <= 62; k++) { const c = PT.addDays(base, k); if (PT.parse(c).getDate() === d) { out.add(c); break; } }
  }
  // a written date beats a weekday ("Friday 21st" means the 21st)
  return out.size ? [...out] : [...days];
};
// Lines from other days' notes that mention this date, plus reminders you sent here yourself.
PT.remindersFor = date => {
  const out = [], day = PT.state.plan[date] || {}, gone = new Set(day.dismissed || []);
  (day.reminders || []).forEach(r => { if (!r.done) out.push({ key: 'r:' + r.id, text: r.text, from: r.from, manual: r }); });
  Object.keys(PT.state.plan).forEach(d => {
    if (d === date || d > date || PT.daysBetween(d, date) > 62) return;
    const note = PT.state.plan[d].note; if (!note) return;
    note.split(/\n+|[.!?]\s+/).map(x => x.trim()).filter(Boolean).forEach(line => {
      const key = d + '|' + line;
      if (!gone.has(key) && PT.datesIn(line, d).includes(date)) out.push({ key, text: line, from: d });
    });
  });
  return out;
};
function remindersCard(date) {
  const list = PT.remindersFor(date);
  if (!list.length) return null;
  return h('div', { class: 'card reminder' },
    h('b', { class: 'red' }, list.length === 1 ? 'Reminder' : list.length + ' reminders'),
    list.map(r => h('div', { class: 'row between', style: { flexWrap: 'nowrap', marginTop: '6px' } },
      h('div', { class: 'grow' }, h('div', {}, r.text), h('div', { class: 'small muted' }, 'from your note on ' + PT.niceDate(r.from))),
      h('button', { class: 'btn ghost small', 'aria-label': 'Done', onclick: () => {
        if (r.manual) r.manual.done = true; else { const d = ensureDay(date); d.dismissed = (d.dismissed || []).concat(r.key); }
        PT.save(); PT.render();
      } }, 'Done ✓'))));
}

/* ---------- day page: shift on top, then drop boxes ---------- */
function dayView(date) {
  const day = PT.state.plan[date] || {};
  const isToday = date === PT.today();
  const root = h('div', {}, PT.back('#/plan', 'Week'), h('h1', {}, isToday ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)));

  // shift: always at the top. Tap one of your usual shifts, or set other times.
  const shift = day.shift ? Object.assign({}, day.shift) : { start: '07:00', end: '15:00' };
  const setShift = sh => { ensureDay(date).shift = sh ? { start: sh.start, end: sh.end } : null; PT.save(); PT.render(); };
  const presets = PT.state.settings.shiftPresets || [];
  const same = sh => day.shift && day.shift.start === sh.start && day.shift.end === sh.end;
  root.append(PT.section('shift', PT.shiftText(day.shift), presets.length ? 'Tap to change' : 'Tap to set your shift', [
    h('div', {},
      presets.map(sh => h('span', { class: 'chip' + (same(sh) ? ' on' : ''), onclick: () => setShift(sh) }, PT.shiftText(sh))),
      h('span', { class: 'chip' + (!day.shift ? ' on' : ''), onclick: () => setShift(null) }, 'Day off')),
    !presets.length ? h('p', { class: 'small muted' }, 'Set the times once and tap "Save as a usual shift". Next time it is one tap. Shifts starting before 12:00 are morning shifts, later ones evening shifts.') : null,
    h('div', { class: 'card', style: { marginTop: '6px' } },
      h('b', {}, 'Other times'),
      h('div', { class: 'grid2', style: { margin: '8px 0' } },
        PT.field('Start', h('input', { type: 'time', value: shift.start, oninput: e => shift.start = e.target.value })),
        PT.field('End', h('input', { type: 'time', value: shift.end, oninput: e => shift.end = e.target.value }))),
      h('div', { class: 'row' },
        h('button', { class: 'btn small grow', onclick: () => setShift(shift) }, 'Use these times'),
        h('button', { class: 'btn ghost small grow', onclick: () => {
          const st = PT.state.settings; st.shiftPresets = st.shiftPresets || [];
          if (!st.shiftPresets.some(x => x.start === shift.start && x.end === shift.end)) st.shiftPresets.push({ start: shift.start, end: shift.end });
          st.shiftPresets.sort((x, y) => x.start < y.start ? -1 : 1);
          setShift(shift); PT.toast('Saved as a usual shift');
        } }, 'Save as a usual shift')))]));

  root.append(remindersCard(date) || '');

  // training: warm-up, exercises, cool-down and other recovery, all in one box
  const train = h('div', {});
  const redraw = () => PT.fill(train, PT.section('training', 'Training', trainSummary(date), training(date, redraw)));
  redraw();
  root.append(train);

  // calendar / day plan
  const evs = day.events || [], ne = { title: '', start: '', end: '' };
  root.append(PT.section('calendar', 'Calendar · day plan', evs.length ? evs.length + (evs.length === 1 ? ' event · ' : ' events · ') + PT.eventsText(evs[0]) : 'Nothing else on', [
    evs.length ? evs.map(ev => h('div', { class: 'card row between' }, h('div', {}, PT.eventsText(ev)),
      h('button', { class: 'btn danger small', onclick: () => { ensureDay(date).events = evs.filter(x => x.id !== ev.id); PT.save(); PT.render(); } }, 'Delete'))) : h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'No events. Import your calendar from the Plan tab, or add one here.'),
    h('div', { class: 'card' },
      PT.field('Add event', h('input', { placeholder: 'e.g. Physio, dinner with a friend', oninput: e => ne.title = e.target.value })),
      h('div', { class: 'grid2', style: { margin: '8px 0' } },
        PT.field('Start (optional)', h('input', { type: 'time', oninput: e => ne.start = e.target.value })),
        PT.field('End (optional)', h('input', { type: 'time', oninput: e => ne.end = e.target.value }))),
      h('button', { class: 'btn small block', onclick: () => {
        if (!ne.title.trim()) { PT.toast('Write what it is first'); return; }
        const d = ensureDay(date); d.events = (d.events || []).concat({ id: PT.uid(), title: ne.title.trim(), start: ne.start, end: ne.end });
        d.events.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1); PT.save(); PT.render();
      } }, 'Add event'))]));

  // fuel: goals faded, you type what you actually had
  const fuelSum = h('div', { class: 'small muted' }, PT.fuelSummary(date));
  root.append(PT.section('fuel', 'Fuel', fuelSum, [
    PT.fuelBlock(date, () => { fuelSum.textContent = PT.fuelSummary(date); }),
    h('div', { style: { marginTop: '10px' } }, PT.fuelTracker()),
    h('a', { class: 'btn ghost small block', style: { marginTop: '10px' }, href: '#/fuel/' + date }, 'Meals & foods ›')]));

  // notes: lines that mention another day show up on that day
  const firstLine = (day.note || '').split('\n')[0];
  const rem = { date: PT.addDays(date, 1), text: '' };
  root.append(PT.section('notes', 'Notes', firstLine ? (firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine) : 'Nothing yet', [
    h('textarea', { placeholder: 'How today went, what to remember… Mention a day ("Wed: bring swim cap", "tomorrow", "the 18th") and it shows up on that day.', value: day.note || '', onchange: e => { ensureDay(date).note = e.target.value; PT.save(); PT.toast('Saved'); } }),
    h('div', { class: 'card', style: { marginTop: '10px' } },
      h('b', {}, 'Remind me on another day'),
      h('div', { class: 'grid2', style: { margin: '8px 0' } },
        PT.field('Day', h('input', { type: 'date', value: rem.date, oninput: e => rem.date = e.target.value })),
        PT.field('Reminder', h('input', { placeholder: 'e.g. book physio', oninput: e => rem.text = e.target.value }))),
      h('button', { class: 'btn small block', onclick: () => {
        if (!rem.text.trim() || !rem.date) { PT.toast('Write the reminder and pick a day'); return; }
        const d = ensureDay(rem.date); d.reminders = (d.reminders || []).concat({ id: PT.uid(), text: rem.text.trim(), from: date });
        PT.save(); PT.toast('Reminder added to ' + PT.niceDate(rem.date)); PT.render();
      } }, 'Add reminder'))]));
  return root;
}

function trainSummary(date) {
  const exs = PT.dayExs(date);
  if (!exs.length) return 'Nothing planned · tap to add exercises';
  const n = exs.filter(PT.hasActual).length;
  return exs.length + (exs.length === 1 ? ' exercise' : ' exercises') + ' · ' + n + ' logged · ' + exs.slice(0, 3).map(e => e.name).join(', ') + (exs.length > 3 ? '…' : '');
}

function training(date, redraw) {
  const exs = PT.dayExs(date), tags = PT.dayTags(date);
  return [
    PT.stretchBlock(date, tags, 'before', true),
    exs.length ? exs.map(en => entryCard(date, en, redraw)) : h('div', { class: 'empty' }, 'Nothing yet. Tap Add exercises and pick from the folders: Chest, Back, Legs, Swim, Run…'),
    h('button', { class: 'btn block', onclick: () => addExercises(date, redraw) }, '+ Add exercises'),
    exs.length ? intensityBox(date, redraw) : null,
    exs.length ? effortBox(date) : null,
    gap(10),
    PT.stretchBlock(date, tags, 'after', true),
    PT.activityBlock(date)
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
