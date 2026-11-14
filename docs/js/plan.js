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
  const trained = days.filter(d => PT.dayCompleted(d)).length;
  const planned = days.filter(d => PT.dayExs(d).length).length;
  const q = PT.todayQuote();
  return h('div', {},
    h('h1', {}, 'Plan'),
    PT.backupNudge ? PT.backupNudge() : null,
    q ? h('div', { class: 'quote' }, '“' + q.text + '”', q.by ? h('small', {}, q.by) : null) : null,
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { anchor = PT.addDays(anchor, -7); PT.render(); } }, '‹'),
      h('div', { class: 'week-title' }, PT.niceDate(days[0]) + ' – ' + PT.niceDate(days[6]),
        h('div', { class: 'small muted' }, planned ? trained + ' of ' + planned + ' training days completed' : 'Nothing planned yet')),
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
  const title = PT.dayTitle(date), completed = PT.dayCompleted(date);
  const rems = PT.remindersFor(date);
  return h('a', { class: 'card tap' + (date === PT.today() ? ' today' : ''), href: '#/plan/' + date },
    h('div', { class: 'day-head' }, h('div', { class: 'day-name' }, PT.dayName(date)), h('div', { class: 'day-date' }, PT.niceDate(date))),
    h('div', { class: 'day-line' + (day.shift ? '' : ' muted') }, PT.shiftText(day.shift)),
    title ? h('div', { class: 'day-line' }, h('b', {}, title), completed ? h('span', { class: 'ok' }, ' · completed ✓') : date < PT.today() ? h('span', { class: 'red' }, ' · not completed') : null)
      : h('div', { class: 'day-line muted' }, 'Rest day'),
    planLine(date) ? h('div', { class: 'day-line small muted' }, planLine(date)) : null,
    rems.map(r => h('div', { class: 'day-line rem' }, h('b', {}, 'Reminder: '), r.text)));
}
// Short "what's planned" line for the week list, e.g. "Treadmill run 5 km · Strength 4 exercises"; after logging "3/5 km".
const amt = (en, x) => en.kind === 'laps' ? (+x.sets || 1) + '×' + (+x.laps || 0) + ' laps' : en.kind === 'cardio' ? (+x.distance || 0) + ' ' + (en.unit || 'km') : en.kind === 'time' ? (+x.rounds || 0) + ' rounds' : '';
function planLine(date) {
  return PT.daySessions(date).map(u => {
    if (u.kind === 'strength') return 'Strength ' + u.items.length + (u.items.length === 1 ? ' exercise' : ' exercises') + (u.done && PT.dayCompleted(date) ? ' ✓' : '');
    const en = u.items[0], pl = PT.hasPlan(en) ? en.plan : null, ac = PT.dayCompleted(date) && PT.hasActual(en) ? en.actual : null;
    if (u.kind === 'time') return u.items.map(e => e.name).join(', ') + (pl ? ' ' + amt(en, pl) : '') + (u.done && PT.dayCompleted(date) ? ' ✓' : '');
    if (ac && pl) {
      if (amt(en, ac) === amt(en, pl)) return en.name + ' ' + amt(en, ac) + ' ✓';
      return en.name + ' ' + (en.kind === 'cardio' ? (+ac.distance || 0) + '/' + amt(en, pl) : en.kind === 'laps' ? (+ac.sets || 1) + '×' + (+ac.laps || 0) + '/' + amt(en, pl) : amt(en, ac) + ' of ' + amt(en, pl)) + ' ✓';
    }
    return en.name + (ac ? ' ' + amt(en, ac) + ' ✓' : pl ? ' ' + amt(en, pl) : '');
  }).join(' · ');
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
  if (PT.dayCompleted(date)) root.append(h('div', { class: 'card', style: { borderColor: 'var(--ok)' } }, h('b', { class: 'ok' }, '✓ Day completed'), h('span', { class: 'small muted' }, ' · logged to Progress')));
  else if (date < PT.today() && PT.dayExs(date).length) root.append(h('div', { class: 'card reminder' }, h('b', { class: 'red' }, 'Not completed yet'), h('div', { class: 'small muted' }, 'Fill in what you did, then tap Complete day at the bottom of Training.')));

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
    PT.dayMeals(date),
    h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => PT.targetsSheet() }, 'Daily macro goals')]));

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
  const status = PT.dayCompleted(date) ? 'completed ✓' : date <= PT.today() ? 'not completed yet' : 'planned';
  return exs.length + (exs.length === 1 ? ' exercise' : ' exercises') + ' · ' + status + ' · ' + exs.slice(0, 3).map(e => e.name).join(', ') + (exs.length > 3 ? '…' : '');
}

function training(date, redraw) {
  const exs = PT.dayExs(date), tags = PT.dayTags(date);
  return [
    PT.stretchBlock(date, tags, 'before', true),
    exs.length ? exs.map(en => entryCard(date, en, redraw)) : h('div', { class: 'empty' }, 'Nothing yet. Tap Add exercises and pick from the folders: Chest, Back, Legs, Swim, Run…'),
    h('button', { class: 'btn block', onclick: () => addExercises(date, redraw) }, '+ Add exercises'),
    exs.length && date <= PT.today() ? effortBox(date) : null,
    gap(10),
    PT.stretchBlock(date, tags, 'after', true),
    PT.activityBlock(date),
    date <= PT.today() && exs.length ? completeBox(date) : null
  ];
}

// "Complete day": the line between what's planned and what's done. Only completed days count in Progress.
function completeBox(date) {
  const day = PT.state.plan[date] || {};
  if (day.completed) return h('div', { class: 'card', style: { borderColor: 'var(--ok)', marginTop: '10px' } },
    h('div', { class: 'row between' }, h('b', { class: 'ok' }, '✓ Day completed'), h('span', { class: 'small muted' }, 'logged to Progress')),
    h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => { day.completed = false; PT.syncDayLog(date); PT.save(); PT.toast('Day reopened'); PT.render(); } }, 'Reopen day to change it'));
  return h('button', { class: 'btn block', style: { marginTop: '12px', minHeight: '56px', fontSize: '18px' }, onclick: () => completeDay(date) }, 'Complete day ✓');
}
function completeDay(date) {
  const d = ensureDay(date), open = d.exs.filter(e => !PT.hasActual(e) && !e.skipped);
  const finish = () => { d.completed = true; d.completedAt = Date.now(); PT.syncDayLog(date); PT.save(); PT.toast('Day completed ✓ Logged to Progress'); PT.render(); };
  if (!open.length) { finish(); return; }
  const planned = open.filter(PT.hasPlan);
  const sh = PT.sheet('Complete day', h('div', {},
    h('p', { style: { marginTop: 0 } }, open.length + (open.length === 1 ? ' exercise has' : ' exercises have') + ' nothing filled in: ' + open.map(e => e.name).join(', ') + '.'),
    planned.length ? h('button', { class: 'btn block', onclick: () => {
      open.forEach(e => { if (PT.hasPlan(e)) e.actual = Object.assign({}, e.plan); else e.skipped = true; });
      sh.close(); finish();
    } }, planned.length === open.length ? (open.length === 1 ? 'I did it as planned' : 'I did them as planned') : 'Log planned ones as planned, skip the rest') : null,
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => { open.forEach(e => e.skipped = true); sh.close(); finish(); } }, 'I skipped ' + (open.length === 1 ? 'it' : 'them')),
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => sh.close() }, open.length === 1 ? 'Go back and fill it in' : 'Go back and fill them in')));
}

function addExercises(date, redraw) {
  PT.browseSheet((list, fromSession) => {
    const d = ensureDay(date);
    list.forEach(x => d.exs.push(PT.makeEntry(x, fromSession ? { fromSession: fromSession.id } : null)));
    PT.save(); redraw();
  }, { onStretch: (id, phase) => { PT.addDayStretch(date, id, phase); redraw(); } });
}

// One exercise: the target (a guide) and what you actually did (what counts).
// One exercise: what you plan (typed by you) and, from the day itself, what you actually did (what gets logged).
function entryCard(date, en, redraw, planMode) {
  const lib = PT.libEx(en), last = PT.lastDone(en, date), canDo = date <= PT.today();
  let editPlan = !!planMode;
  const p = en.plan || (en.plan = {}), a = en.actual || {};
  const pill = h('span', { class: 'pill' + (en.skipped ? '' : ' done') }, en.skipped ? 'skipped' : '✓ logged');
  const extra = h('div', { class: 'small muted', style: { marginTop: '6px' } });
  function status() {
    pill.style.display = (PT.dayCompleted(date) && PT.hasActual(en)) || en.skipped ? '' : 'none';
    let txt = '';
    if (en.kind === 'laps' && +a.laps) txt = '= ' + (+a.sets || 1) * a.laps * PT.pool() + ' m (' + PT.pool() + ' m pool)';
    if (en.kind === 'cardio' && +a.distance && +a.time) txt = 'Pace ' + PT.fmtDur(Math.round(a.time / (en.unit === 'm' ? a.distance / 100 : a.distance))) + (en.unit === 'm' ? ' /100m' : ' /km');
    extra.textContent = txt;
  }
  const savePlan = () => { en.plan = p; PT.save(); };
  const saveDone = () => { en.actual = a; en.skipped = false; PT.syncDayLog(date); PT.save(); status(); };
  // the same boxes for plan and done; done boxes show the plan faded so you only type what was different
  const boxes = (o, save, ph) => {
    const num = (k, label, step) => PT.field(label, PT.numInput(o[k], v => { o[k] = v; save(); }, ph && +ph[k] ? String(ph[k]) : '', step));
    const dur = (k, label, def) => PT.field(label, PT.durInput(o[k], v => { o[k] = v; save(); }, ph && +ph[k] ? PT.fmtDur(ph[k]) : def));
    return en.kind === 'laps' ? h('div', { class: 'grid3' }, num('sets', 'Sets', '1'), num('laps', 'Laps', '1'), dur('time', 'Time', 'm:ss'))
      : en.kind === 'cardio' ? h('div', { class: 'grid2' }, num('distance', 'Distance (' + (en.unit || 'km') + ')'), dur('time', 'Time', 'h:mm:ss'))
      : en.kind === 'time' ? h('div', { class: 'grid2' }, num('rounds', 'Rounds', '1'), dur('time', 'Time per round', 'm:ss'))
      : h('div', { class: 'grid3' }, num('sets', 'Sets', '1'), num('reps', 'Reps', '1'), num('kg', 'Kg', '0.5'));
  };
  const range = PT.hasRange(lib) && (lib.kind || 'strength') === en.kind
    ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'Your range: ' + PT.exText(PT.atLevel(lib, 1)) + '  →  max ' + PT.exText(PT.atLevel(lib, 10)))
    : lib ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, h('button', { class: 'back small', style: { color: 'var(--muted)', margin: 0, textDecoration: 'underline' }, onclick: () => {
        const box = h('div', {}); const sh = PT.sheet('Min / max: ' + lib.name, box); PT.rangeForm(box, lib, () => { sh.close(); redraw(); });
      } }, 'Set your min/max (optional)')) : null;
  const el = h('div', { class: 'card' },
    h('div', { class: 'row between', style: { flexWrap: 'nowrap' } },
      h('h3', { class: 'grow' }, en.name), pill,
      h('button', { class: 'btn ghost small', 'aria-label': 'Remove ' + en.name, onclick: () => {
        const go = () => { const d = ensureDay(date); d.exs = d.exs.filter(x => x.id !== en.id); PT.syncDayLog(date); PT.save(); redraw(); };
        if (PT.hasActual(en)) PT.confirm('Remove ' + en.name + ' and what you logged for it?', 'Remove', go); else go();
      } }, '✕')),
    last ? h('div', { class: 'small muted', style: { marginTop: '2px' } }, 'Last time (' + PT.niceDate(last.date) + '): ' + PT.exText(Object.assign({ kind: en.kind, unit: en.unit }, last.ex))) : null,
    gap(8),
    // One set of boxes. Planning ahead: you type the plan and it shows faded. On the day: the plan sits faded in the
    // boxes and what you type is solid; that is what gets logged. "Change plan" edits the faded numbers.
    !canDo || editPlan
      ? [h('label', { class: 'f' }, canDo ? 'Change plan' : 'Planned'), h('div', { class: 'planned' }, boxes(p, savePlan, null)),
         canDo ? h('button', { class: 'back small', style: { margin: '6px 0 0', color: 'var(--red2)' }, onclick: () => { editPlan = false; el.replaceWith(entryCard(date, en, redraw)); } }, 'Done changing plan') : null]
      : [h('div', { class: 'row between', style: { flexWrap: 'nowrap' } },
           h('label', { class: 'f', style: { color: 'var(--red2)', margin: 0 } }, PT.hasPlan(en) ? 'Done · faded = planned' : 'Done'),
           h('button', { class: 'back small', style: { margin: 0, color: 'var(--muted)', textDecoration: 'underline' }, onclick: () => { editPlan = true; el.replaceWith(entryCard(date, en, redraw, true)); } }, PT.hasPlan(en) ? 'Change plan' : 'Add a plan')),
         gap(4), boxes(a, saveDone, p), extra,
         PT.hasPlan(en) ? h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => {
           (PT.FIELDS[en.kind] || []).forEach(k => { if (+p[k]) a[k] = p[k]; });
           saveDone(); el.replaceWith(entryCard(date, en, redraw)); PT.toast('Logged as planned');
         } }, 'Did the plan ✓') : null],
    range);
  status();
  return el;
}

function effortBox(date) {
  const day = PT.state.plan[date] || {};
  const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, String(n)]);
  return h('div', { class: 'card', style: { marginTop: '10px' } },
    h('label', { class: 'f' }, 'How hard was today, after training? (1 easy – 10 max)'),
    (() => { const sg = PT.seg(opts, +day.rpe || 0, v => { ensureDay(date).rpe = v; PT.syncDayLog(date); PT.save(); }); sg.classList.add('tight'); return sg; })());
}
})();
