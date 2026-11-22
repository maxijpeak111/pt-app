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

/* ---------- week: today big at the top, then the week as slim rows ---------- */
function weekView() {
  if (!anchor) anchor = PT.weekStart(PT.today());
  const today = PT.today(), days = [0, 1, 2, 3, 4, 5, 6].map(i => PT.addDays(anchor, i));
  const trained = days.filter(d => PT.dayCompleted(d)).length;
  const planned = days.filter(d => PT.dayExs(d).length).length;
  const thisWs = PT.weekStart(today), q = PT.todayQuote();
  const label = anchor === thisWs ? 'This week' : anchor === PT.addDays(thisWs, 7) ? 'Next week' : anchor === PT.addDays(thisWs, -7) ? 'Last week' : 'Week of ' + PT.niceDate(anchor);
  const move = n => { anchor = PT.addDays(anchor, n); PT.render(); };
  return h('div', {},
    h('h1', {}, 'Plan'),
    todayHero(today),
    PT.backupNudge ? PT.backupNudge() : null,
    PT.photoNudge ? PT.photoNudge() : null,
    q ? h('div', { class: 'quote' }, '“' + q.text + '”', q.by ? h('small', {}, q.by) : null) : null,
    h('div', { class: 'wk-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous week', onclick: () => move(-7) }, PT.icon('left')),
      h('div', { class: 'wk-title' }, h('b', {}, label), h('div', { class: 'small' }, planned ? trained + ' of ' + planned + ' training days done' : 'Nothing planned yet')),
      h('button', { class: 'icon-btn', 'aria-label': 'Next week', onclick: () => move(7) }, PT.icon('right'))),
    h('div', { class: 'wrows' }, days.filter(d => d !== today).map(weekRow)),
    PT.weeklyCard ? PT.weeklyCard(anchor) : null,
    h('div', { class: 'wk-tools' },
      anchor !== thisWs ? h('button', { class: 'btn ghost small', onclick: () => { anchor = thisWs; PT.render(); } }, 'Back to this week') : null,
      h('button', { class: 'btn ghost small', onclick: copyShifts }, 'Copy last week’s shifts'),
      h('button', { class: 'btn ghost small', onclick: () => PT.importSheet() }, 'Import calendar')));
}

// Short amount for an exercise: what you did once logged, otherwise the plan.
function amtOf(en) {
  if (en.skipped) return 'Skipped';
  const x = PT.hasActual(en) ? en.actual : PT.hasPlan(en) ? en.plan : null;
  return x ? PT.exText(Object.assign({ kind: en.kind, unit: en.unit }, x)) : '';
}

// Today, big: training title, shift, progress ring, what's on, and one button in.
function todayHero(date) {
  const day = PT.state.plan[date] || {}, exs = day.exs || [], completed = PT.dayCompleted(date);
  const ag = PT.dayAgenda(date).filter(x => !x.suggested), pr = PT.dayProgress(date), rems = PT.remindersFor(date);
  return h('div', { class: 'hero' + (completed ? ' done' : '') },
    h('div', { class: 'hero-top' },
      h('div', { class: 'grow' },
        h('div', { class: 'eyebrow' + (completed ? ' ok' : '') }, completed ? 'Today · complete ✓' : 'Today · ' + PT.niceDate(date)),
        h('div', { class: 'hero-title' }, PT.dayTitle(date) || 'Rest day'),
        h('div', { class: 'hero-sub' }, PT.shiftText(day.shift))),
      pr.total ? PT.ring(completed ? pr.total : pr.done, pr.total, 76) : null),
    exs.length || ag.length ? h('div', { class: 'hero-list' },
      exs.map(en => h('div', { class: 'hero-ex' + (PT.hasActual(en) ? ' done' : '') }, h('span', {}, en.name), h('span', {}, PT.hasActual(en) ? h('span', { class: 'ok-mark' }, '✓ ') : null, amtOf(en)))),
      ag.map(x => h('div', { class: 'hero-ex' + (x.done ? ' done' : '') }, h('span', {}, x.title), h('span', {}, x.done ? h('span', { class: 'ok-mark' }, '✓ ') : null, x.time ? x.time + (x.end ? '–' + x.end : '') : '')))) : null,
    rems.map(r => h('div', { class: 'rem-line' }, h('b', {}, 'Reminder: '), r.text)),
    h('a', { class: 'btn block' + (completed ? ' ghost' : ''), href: '#/plan/' + date }, completed ? 'Open today' : exs.length ? 'Start today' : 'Open today'));
}

// One slim row per day: date, training, shift and what's planned, and a done tick.
function weekRow(date) {
  const day = PT.state.plan[date] || {}, exs = day.exs || [], title = PT.dayTitle(date);
  const completed = PT.dayCompleted(date), past = date < PT.today();
  const ag = PT.dayAgenda(date).filter(x => !x.suggested), rems = PT.remindersFor(date);
  const sub = [day.shift ? PT.shiftText(day.shift).replace(' shift', '') : 'Day off', planLine(date), ag.length ? ag.length + ' in calendar' : ''].filter(Boolean).join(' · ');
  return h('a', { class: 'wrow' + (exs.length ? '' : ' rest'), href: '#/plan/' + date },
    h('div', { class: 'wrow-date' }, h('small', {}, PT.dayName(date).toUpperCase()), h('b', {}, PT.parse(date).getDate())),
    h('div', { class: 'wrow-main' },
      h('div', { class: 'wrow-title' }, title || 'Rest day'),
      h('div', { class: 'wrow-sub' }, rems.length ? h('b', {}, (rems.length === 1 ? 'Reminder' : rems.length + ' reminders') + ' · ') : null, sub)),
    h('div', { class: 'wrow-end' },
      completed ? h('span', { class: 'st-done', 'aria-label': 'Completed' }, PT.icon('check', 3)) : past && exs.length ? h('span', { class: 'st-miss' }, 'Not done') : null,
      completed ? null : PT.icon('chev')));
}

// How much of a day is ticked off: each exercise, the warm-up, the cool-down, and calendar items.
function stretchState(date, tags, phase) {
  const { list, SHOW } = PT.stretchList(date, tags, phase, true);
  const d = (PT.state.recoveryLog[date] || {}).done || {};
  const count = list.filter(x => d[x.id]).length, need = Math.min(SHOW, list.length);
  return { total: list.length, count, need, done: list.length > 0 && count >= need, list, SHOW };
}
PT.dayProgress = date => {
  const exs = PT.dayExs(date), items = exs.map(en => PT.hasActual(en) || !!en.skipped);
  if (exs.length && PT.stretchList) { const tags = PT.dayTags(date); ['before', 'after'].forEach(ph => { const s = stretchState(date, tags, ph); if (s.total) items.push(s.done); }); }
  PT.dayAgenda(date).filter(x => !x.suggested).forEach(x => items.push(!!x.done));
  return { done: items.filter(Boolean).length, total: items.length };
};

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

/* ---------- day page: big header with progress, then a checklist of the day ---------- */
const openTask = {}; // which task rows are opened up (date + id)
function dayView(date) {
  const day = PT.state.plan[date] || {};
  const isToday = date === PT.today(), completed = PT.dayCompleted(date);
  const eyebrow = completed ? 'Day complete ✓' : isToday ? 'Today · ' + PT.niceDate(date) : date === PT.addDays(PT.today(), 1) ? 'Tomorrow · ' + PT.niceDate(date) : PT.niceDate(date);
  const ringBox = h('div', {});
  const refreshRing = () => { const pr = PT.dayProgress(date); PT.fill(ringBox, pr.total ? PT.ring(completed ? pr.total : pr.done, pr.total, 92) : null); };
  refreshRing();
  const root = h('div', {}, PT.back('#/plan', 'Week'),
    h('div', { class: 'day-hero' },
      h('div', { class: 'grow' },
        h('div', { class: 'eyebrow' + (completed ? ' ok' : isToday ? '' : ' muted') }, eyebrow),
        h('h1', {}, PT.dayTitle(date) || 'Rest day'),
        h('button', { class: 'chip-btn' + (day.shift ? '' : ' off'), onclick: () => shiftSheet(date) }, PT.icon('clock'), PT.shiftText(day.shift).replace(' shift', ''), h('span', { class: 'muted' }, '›'))),
      ringBox));

  root.append(remindersCard(date) || '');
  if (completed) root.append(h('div', { class: 'done-banner' }, h('span', { class: 'st-done' }, PT.icon('check', 3)),
    h('div', { class: 'grow' }, h('b', {}, 'Day completed'), h('div', { class: 'small muted' }, 'Logged to Progress')),
    h('button', { class: 'btn ghost small', onclick: () => { ensureDay(date).completed = false; PT.syncDayLog(date); PT.save(); PT.toast('Day reopened'); PT.render(); } }, 'Reopen')));
  else if (date < PT.today() && PT.dayExs(date).length) root.append(h('div', { class: 'card reminder' }, h('b', { class: 'red' }, 'Not completed yet'), h('div', { class: 'small muted' }, 'Tick off what you did, then tap Complete day.')));

  // training checklist
  const exs = PT.dayExs(date), tags = PT.dayTags(date), canDo = date <= PT.today();
  const tdone = exs.filter(en => PT.hasActual(en) || en.skipped).length;
  root.append(h('h2', { class: 'grp' }, 'Training', exs.length ? h('span', {}, canDo ? tdone + ' of ' + exs.length + ' logged' : exs.length + (exs.length === 1 ? ' exercise' : ' exercises')) : null));
  const list = h('div', { class: 'tasks' });
  if (exs.length) list.append(stretchTask(date, tags, 'before', refreshRing));
  exs.forEach(en => list.append(exTask(date, en, refreshRing)));
  if (exs.length) list.append(stretchTask(date, tags, 'after', refreshRing));
  list.append(saunaTask(date));
  [list,
    exs.length ? null : h('div', { class: 'small muted', style: { margin: '12px 0 0' } }, 'Nothing planned. Add exercises from the folders (Chest, Back, Legs, Swim, Run…) or drop in a saved session.'),
    h('button', { class: 'btn block ' + (exs.length ? 'add' : 'big'), style: exs.length ? null : { marginTop: '14px' }, onclick: () => addExercises(date, PT.render) }, '+ Add exercises'),
    exs.length && canDo ? effortBox(date) : null,
    canDo && exs.length && !completed ? h('button', { class: 'btn block big', style: { marginTop: '18px' }, onclick: () => completeDay(date) }, 'Complete day ✓') : null].forEach(x => { if (x) root.append(x); });

  // day plan: calendar events, regular items and weekly jobs, earliest first
  const ag = PT.dayAgenda(date), agOn = ag.filter(x => !x.suggested);
  root.append(h('h2', { class: 'grp' }, 'Day plan', agOn.length ? h('span', {}, agOn.filter(x => x.done).length + ' of ' + agOn.length + ' done') : null),
    h('div', { class: 'flat' }, PT.agendaList(date)),
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn ghost small grow', onclick: () => eventSheet(date) }, '+ Add event'),
      h('a', { class: 'btn ghost small grow', href: '#/more/regular' }, 'Regular schedule ›')));

  // fuel and notes stay as drop boxes
  const fuelSum = h('div', { class: 'small muted' }, PT.fuelSummary(date));
  const firstLine = (day.note || '').split('\n')[0];
  const rem = { date: PT.addDays(date, 1), text: '' };
  root.append(h('div', { class: 'day-extra' },
    PT.section('fuel', 'Fuel', fuelSum, [
      PT.fuelBlock(date, () => { fuelSum.textContent = PT.fuelSummary(date); }),
      PT.dayMeals(date),
      h('a', { class: 'btn ghost small block', style: { marginTop: '8px' }, href: '#/more/body' }, 'Daily macro goals ›')]),
    // notes: lines that mention another day show up on that day
    PT.section('notes', 'Notes', firstLine ? (firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine) : 'Nothing yet', [
      h('textarea', { placeholder: 'How today went, what to remember… Mention a day ("Wed: bring swim cap", "tomorrow", "the 18th") and it shows up on that day.', value: day.note || '', onchange: e => { ensureDay(date).note = e.target.value; PT.save(); PT.toast('Saved'); } }),
      h('div', { class: 'card', style: { marginTop: '10px' } },
        h('b', {}, 'Remind me on another day'),
        h('div', { class: 'grid2', style: { margin: '8px 0' } },
          PT.field('Day', h('input', { type: 'date', value: rem.date, oninput: e => rem.date = e.target.value })),
          PT.field('Reminder', h('input', { placeholder: 'e.g. book physio', oninput: e => rem.text = e.target.value }))),
        h('button', { class: 'btn ghost small block', onclick: () => {
          if (!rem.text.trim() || !rem.date) { PT.toast('Write the reminder and pick a day'); return; }
          const d = ensureDay(rem.date); d.reminders = (d.reminders || []).concat({ id: PT.uid(), text: rem.text.trim(), from: date });
          PT.save(); PT.toast('Reminder added to ' + PT.niceDate(rem.date)); PT.render();
        } }, 'Add reminder'))])));
  return root;
}

// One row in the checklist: small tag, big name, amount underneath, round tick on the right.
// Tapping the row opens it up underneath (to log details); the tick is the quick way to mark it done.
function taskRow(key, o) {
  const tick = o.tick === undefined ? null : h('button', { class: 'tick' + (o.tick === 'skip' ? ' skip' : o.tick ? ' on' : ''), 'aria-label': o.tick ? 'Done' : 'Mark done', onclick: e => { e.stopPropagation(); o.onTick(); } }, PT.icon(o.tick === 'skip' ? 'plus' : 'check', 3));
  if (tick && o.tick === 'skip') tick.firstChild.style.transform = 'rotate(45deg)';
  const body = h('div', { class: 'task-body' });
  const wrap = h('div', { class: 'task' + (o.done ? ' done' : '') + (o.tick === 'skip' ? ' skipped' : '') + (openTask[key] ? ' open' : '') },
    h('div', { class: 'task-row', onclick: () => { openTask[key] = !openTask[key]; wrap.classList.toggle('open', openTask[key]); show(); } },
      h('div', { class: 'task-main' }, o.tag ? h('div', { class: 'task-tag' }, o.tag) : null, h('div', { class: 'task-name' }, o.name), h('div', { class: 'task-amt' }, o.amt)),
      tick || h('span', { class: 'task-chev' }, PT.icon('chev'))),
    body);
  function show() { if (openTask[key]) { if (!body.firstChild) PT.fill(body, o.body()); body.style.display = ''; } else body.style.display = 'none'; }
  show();
  return wrap;
}

function exTask(date, en, refreshRing) {
  const canDo = date <= PT.today(), lib = PT.libEx(en), sport = PT.entrySport(en);
  const tag = sport ? PT.tagLabel(sport) : lib && (lib.muscles || [])[0] ? PT.tagLabel(lib.muscles[0]) : '';
  const amtLine = () => {
    if (en.skipped) return 'Skipped · tap to log it after all';
    if (PT.hasActual(en)) return h('span', {}, h('span', { class: 'ok' }, '✓ '), amtOf(en));
    if (PT.hasPlan(en)) return (canDo ? 'Plan: ' : '') + amtOf(en);
    return canDo ? 'Tap to fill in what you did' : 'Tap to set the plan';
  };
  const key = date + en.id;
  const row = taskRow(key, {
    tag, name: en.name, amt: amtLine(), done: PT.hasActual(en),
    tick: canDo ? (en.skipped ? 'skip' : PT.hasActual(en)) : undefined,
    onTick: () => {
      // quick log: no numbers yet and a plan → log it as planned; otherwise open it to type
      if (!PT.hasActual(en) && !en.skipped && PT.hasPlan(en)) {
        en.actual = Object.assign({}, en.plan); en.skipped = false; PT.syncDayLog(date); PT.save(); PT.toast('Logged as planned ✓'); PT.render();
      } else { openTask[key] = true; PT.render(); }
    },
    body: () => entryCard(date, en, PT.render)
  });
  // typing in the boxes updates the row and the ring straight away
  row.addEventListener('input', () => setTimeout(() => {
    const t = row.querySelector('.task-amt'); if (t) PT.fill(t, amtLine());
    const tk = row.querySelector('.tick'); if (tk) tk.classList.toggle('on', PT.hasActual(en));
    row.classList.toggle('done', PT.hasActual(en)); refreshRing();
  }));
  return row;
}

function stretchTask(date, tags, phase, refreshRing) {
  const before = phase === 'before', key = date + phase;
  const st = stretchState(date, tags, phase);
  const amt = s => s.total ? (s.done ? h('span', {}, h('span', { class: 'ok' }, '✓ '), s.count + ' moves done') : s.count ? s.count + ' of ' + s.need + ' moves done' : s.need + ' moves matched to today') : 'Pick moves from the folders';
  const row = taskRow(key, {
    tag: before ? 'Before' : 'After', name: before ? 'Warm-up' : 'Cool-down', amt: amt(st), done: st.done,
    tick: date <= PT.today() && st.total ? st.done : undefined,
    onTick: () => {
      if (st.done) { openTask[key] = true; PT.render(); return; }
      const d = PT.state.recoveryLog[date] = PT.state.recoveryLog[date] || {}; d.done = d.done || {};
      st.list.slice(0, st.SHOW).forEach(x => d.done[x.id] = true); PT.save(); PT.render();
    },
    body: () => { const b = PT.stretchBlock(date, tags, phase, true), det = b.querySelector('details'); if (det) det.open = true; return b; }
  });
  row.addEventListener('change', () => setTimeout(() => {
    const s = stretchState(date, tags, phase); PT.fill(row.querySelector('.task-amt'), amt(s));
    const tk = row.querySelector('.tick'); if (tk) tk.classList.toggle('on', s.done); row.classList.toggle('done', s.done); refreshRing();
  }));
  return row;
}

function saunaTask(date) {
  const txt = () => { const r = PT.state.recoveryLog[date] || {}; return [+r.sauna ? r.sauna + ' min sauna' : '', +r.steam ? r.steam + ' min steam room' : ''].filter(Boolean).join(' · '); };
  const row = taskRow(date + 'sauna', { tag: 'Recovery', name: 'Sauna & steam', amt: txt() || 'Optional · tap to add minutes', done: !!txt(), body: () => PT.activityBlock(date) });
  row.addEventListener('input', () => setTimeout(() => { row.querySelector('.task-amt').textContent = txt() || 'Optional · tap to add minutes'; }));
  return row;
}

// Shift: one tap for your usual shifts, or set other times.
function shiftSheet(date) {
  const day = PT.state.plan[date] || {};
  const shift = day.shift ? Object.assign({}, day.shift) : { start: '07:00', end: '15:00' };
  let sh;
  const setShift = s => { ensureDay(date).shift = s ? { start: s.start, end: s.end } : null; PT.save(); sh.close(); PT.render(); };
  const presets = PT.state.settings.shiftPresets || [];
  const same = s => day.shift && day.shift.start === s.start && day.shift.end === s.end;
  sh = PT.sheet('Shift · ' + PT.niceDate(date), h('div', {},
    h('div', {},
      presets.map(s => h('span', { class: 'chip' + (same(s) ? ' on' : ''), onclick: () => setShift(s) }, PT.shiftText(s))),
      h('span', { class: 'chip' + (!day.shift ? ' on' : ''), onclick: () => setShift(null) }, 'Day off')),
    !presets.length ? h('p', { class: 'small muted' }, 'Set the times once and tap "Save as a usual shift". Next time it is one tap. Shifts starting before 12:00 are morning shifts, later ones evening shifts.') : null,
    h('h2', {}, 'Other times'),
    h('div', { class: 'grid2', style: { margin: '0 0 10px' } },
      PT.field('Start', h('input', { type: 'time', value: shift.start, oninput: e => shift.start = e.target.value })),
      PT.field('End', h('input', { type: 'time', value: shift.end, oninput: e => shift.end = e.target.value }))),
    h('div', { class: 'row' },
      h('button', { class: 'btn small grow', onclick: () => setShift(shift) }, 'Use these times'),
      h('button', { class: 'btn ghost small grow', onclick: () => {
        const st = PT.state.settings; st.shiftPresets = st.shiftPresets || [];
        if (!st.shiftPresets.some(x => x.start === shift.start && x.end === shift.end)) st.shiftPresets.push({ start: shift.start, end: shift.end });
        st.shiftPresets.sort((x, y) => x.start < y.start ? -1 : 1);
        setShift(shift); PT.toast('Saved as a usual shift');
      } }, 'Save as a usual shift'))));
}

function eventSheet(date) {
  const ne = { title: '', start: '', end: '' };
  const sh = PT.sheet('Add event · ' + PT.niceDate(date), h('div', {},
    PT.field('What', h('input', { placeholder: 'e.g. Physio, dinner with a friend', oninput: e => ne.title = e.target.value })),
    h('div', { class: 'grid2', style: { margin: '10px 0 14px' } },
      PT.field('Start (optional)', h('input', { type: 'time', oninput: e => ne.start = e.target.value })),
      PT.field('End (optional)', h('input', { type: 'time', oninput: e => ne.end = e.target.value }))),
    h('button', { class: 'btn block', onclick: () => {
      if (!ne.title.trim()) { PT.toast('Write what it is first'); return; }
      const d = ensureDay(date); d.events = (d.events || []).concat({ id: PT.uid(), title: ne.title.trim(), start: ne.start, end: ne.end });
      d.events.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1); PT.save(); sh.close(); PT.render();
    } }, 'Add event')));
}

// The short "Day complete" moment.
PT.celebrate = (title, sub) => {
  const el = h('div', { class: 'celebrate' }, h('div', { class: 'cel-ring' }, PT.icon('check', 3)), h('b', {}, title || 'Day complete'), sub ? h('small', {}, sub) : null);
  document.body.append(el); setTimeout(() => el.remove(), 1950);
};

// "Complete day": the line between what's planned and what's done. Only completed days count in Progress.
function completeDay(date) {
  const d = ensureDay(date), open = d.exs.filter(e => !PT.hasActual(e) && !e.skipped);
  const finish = () => { d.completed = true; d.completedAt = Date.now(); PT.syncDayLog(date); PT.save(); PT.render(); PT.celebrate('Day complete', 'Logged to Progress'); };
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
  }, { planForm: true });
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
  const el = h('div', { class: 'card entry' },
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
