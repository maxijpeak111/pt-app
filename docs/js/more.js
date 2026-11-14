(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });
PT.moreViews = {};

PT.views.more = function (parts) {
  const v = parts[1] && PT.moreViews[parts[1]];
  if (v) return v(parts);
  const items = [['#/more/progress', 'Goals & history'], ['#/more/sleep', 'Sleep'], ['#/more/mind', 'Meditation'], ['#/more/code', 'Your code (motivation)'], ['#/more/settings', 'Settings & backup']];
  return h('div', {}, h('h1', {}, 'More'), h('div', { class: 'menu' }, items.map(([href, l]) => h('a', { href }, l, h('span', {}, '›')))));
};

/* ---------- Progress tab: one week at a time ---------- */
let pWeek = null; // Monday of the week being viewed
const inRange = (d, a, b) => d >= a && d < b;
// Distances from a list of logs. Runs in km; swims in metres (laps × pool length).
const runKm = logs => logs.reduce((a, l) => a + (l.exercises || []).reduce((b, e) => b + (e.kind === 'cardio' && (e.sport === 'run' || (!e.sport && l.type === 'run')) ? (e.unit === 'm' ? +e.distance / 1000 : +e.distance) || 0 : 0), 0), 0);
const swimM = logs => logs.reduce((a, l) => a + (l.exercises || []).reduce((b, e) => b + (e.kind === 'laps' ? (+e.sets || 1) * (+e.laps || 0) * PT.pool() : e.kind === 'cardio' && e.sport === 'swim' ? (e.unit === 'km' ? +e.distance * 1000 : +e.distance) || 0 : 0), 0), 0);
const heaviest = (logs, name) => Math.max(0, ...logs.flatMap(l => (l.exercises || []).filter(e => e.name === name && e.kind === 'strength').map(e => +e.kg || 0)));
const longestRun = logs => Math.max(0, ...logs.flatMap(l => (l.exercises || []).filter(e => e.kind === 'cardio' && e.sport === 'run').map(e => (e.unit === 'm' ? +e.distance / 1000 : +e.distance) || 0)));
const mostSwim = logs => Math.max(0, ...logs.map(l => swimM([l])));
PT.weekStats = ws => {
  const we = PT.addDays(ws, 7), s = PT.state;
  const logs = s.logs.filter(l => inRange(l.date, ws, we)), before = s.logs.filter(l => l.date < ws);
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => PT.addDays(ws, i));
  // recovery: ticked vs shown before/after moves on days you had exercises
  let planned = 0, done = 0; const mins = { sauna: 0, bike: 0, walk: 0 };
  days.forEach(d => {
    const r = s.recoveryLog[d] || {}; Object.keys(mins).forEach(k => mins[k] += +r[k] || 0);
    if (!PT.dayExs(d).length || d > PT.today()) return; // only days that have happened count
    const tags = PT.dayTags(d);
    PT.PHASES.forEach(([ph]) => { const { list, SHOW } = PT.stretchList(d, tags, ph); const shown = list.slice(0, SHOW); planned += shown.length; done += shown.filter(x => (r.done || {})[x.id]).length; });
  });
  const met = days.map(d => PT.macrosMet(d));
  // planned vs done, from each day's exercises (a session = all strength moves that day, or one run / swim / bike)
  const units = days.flatMap(d => PT.daySessions(d));
  const runs = units.filter(u => u.sport === 'run'), swims = units.filter(u => u.sport === 'swim');
  const planKm = list => list.reduce((a, u) => a + PT.entryKm(u.items[0], 'plan'), 0);
  const doneKm = list => list.reduce((a, u) => a + PT.entryKm(u.items[0], 'actual'), 0);
  return { logs, before, days, sessions: units.filter(u => u.done).length, sessionsPlanned: units.length,
    runsDone: runs.filter(u => u.done).length, runsPlanned: runs.length, runKmPlan: PT.r1(planKm(runs)), swimMPlan: Math.round(planKm(swims) * 1000), planned, done,
    recPct: planned ? Math.round(done / planned * 100) : null,
    // done distances straight from the days (plus any older logs that have no day entries behind them)
    runKm: PT.r1(doneKm(runs) + runKm(logs.filter(l => !PT.dayExs(l.date).length))), swimM: Math.round(doneKm(swims) * 1000 + swimM(logs.filter(l => !PT.dayExs(l.date).length))), mins, met, metDays: met.filter(x => x === true).length, fuelDays: met.filter(x => x !== null).length };
};
// The standout of the week: a new best beats everything, then volume.
function bestStat(w) {
  const wins = [];
  const lifts = [...new Set(w.logs.flatMap(l => (l.exercises || []).filter(e => e.kind === 'strength' && +e.kg).map(e => e.name)))];
  lifts.forEach(n => { const now = heaviest(w.logs, n), prev = heaviest(w.before, n); if (prev && now > prev) wins.push([100 + (now - prev) / prev * 100, 'New best: ' + n + ' ' + now + ' kg', '+' + PT.r1(now - prev) + ' kg on your previous best']); });
  const lr = longestRun(w.logs), plr = longestRun(w.before); if (plr && lr > plr) wins.push([90, 'Longest run yet: ' + lr + ' km', 'previous longest ' + plr + ' km']);
  const ms = mostSwim(w.logs), pms = mostSwim(w.before); if (pms && ms > pms) wins.push([85, 'Biggest swim yet: ' + ms + ' m', 'previous best ' + pms + ' m']);
  if (w.fuelDays && w.metDays >= 5) wins.push([70, 'Macros on point ' + w.metDays + ' of 7 days', 'eating habits locked in']);
  if (w.recPct != null && w.recPct >= 80) wins.push([60, 'Recovery ' + w.recPct + '% done', w.done + ' of ' + w.planned + ' warm-ups and stretches']);
  if (w.sessions) wins.push([50, w.sessions + (w.sessions === 1 ? ' session' : ' sessions') + ' logged', w.runKm ? w.runKm + ' km run' : w.swimM ? w.swimM + ' m swum' : 'keep it rolling']);
  wins.sort((a, b) => b[0] - a[0]);
  return wins[0] || null;
}
PT.views.progress = function (parts) {
  if (!pWeek) pWeek = PT.weekStart(PT.today());
  const w = PT.weekStats(pWeek), last = PT.weekStats(PT.addDays(pWeek, -7));
  const best = bestStat(w);
  const tile = (value, label, note) => h('div', { class: 'card', style: { margin: 0 } }, h('div', { class: 'stat', style: { fontSize: String(value).length > 8 ? '20px' : '' } }, value), h('div', { class: 'small' }, h('b', {}, label)), note ? h('div', { class: 'small muted' }, note) : null);
  const lifts = [...new Set(w.logs.flatMap(l => (l.exercises || []).filter(e => e.kind === 'strength' && +e.kg).map(e => e.name)))].sort();
  return h('div', {},
    h('h1', {}, 'Progress'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { pWeek = PT.addDays(pWeek, -7); PT.render(); } }, '‹'),
      h('div', { class: 'week-title' }, PT.niceDate(pWeek) + ' – ' + PT.niceDate(PT.addDays(pWeek, 6)),
        h('div', { class: 'small muted' }, pWeek === PT.weekStart(PT.today()) ? 'This week' : pWeek > PT.today() ? 'Coming up' : 'Past week')),
      h('button', { class: 'btn ghost small', onclick: () => { pWeek = PT.addDays(pWeek, 7); PT.render(); } }, '›')),
    h('div', { class: 'card reminder' }, h('div', { class: 'small red', style: { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' } }, 'Best of the week'),
      best ? [h('div', { class: 'stat', style: { fontSize: '22px', marginTop: '4px' } }, best[1]), h('div', { class: 'small muted' }, best[2])] : h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'Nothing logged this week yet.')),
    h('div', { class: 'grid2', style: { marginTop: '10px' } },
      tile(w.sessionsPlanned ? w.sessions + ' / ' + w.sessionsPlanned : w.sessions, 'Sessions done', (w.sessionsPlanned ? 'done of planned · ' : '') + 'last week ' + last.sessions),
      tile(w.runKmPlan ? w.runKm + ' / ' + w.runKmPlan + ' km' : w.runKm + ' km', 'Run distance', (w.runsPlanned ? w.runsDone + ' of ' + w.runsPlanned + (w.runsPlanned === 1 ? ' run · ' : ' runs · ') : '') + 'last week ' + last.runKm + ' km'),
      tile(w.swimMPlan ? w.swimM + ' / ' + w.swimMPlan + ' m' : w.swimM + ' m', 'Swim distance', (w.swimM ? Math.round(w.swimM / PT.pool()) + ' laps · ' : '') + 'last week ' + last.swimM + ' m'),
      tile(w.recPct == null ? '–' : w.recPct + '%', 'Recovery done', w.planned ? w.done + ' of ' + w.planned + ' warm-ups & stretches' : 'no training days yet')),
    h('div', { class: 'small muted', style: { margin: '8px 2px 0' } }, 'Sauna ' + w.mins.sauna + ' min · bike ' + w.mins.bike + ' min · walk ' + w.mins.walk + ' min'),
    h('h2', {}, 'Right macros'),
    h('div', { class: 'card' },
      h('div', { class: 'row between small' }, h('b', {}, w.metDays + ' of 7 days on target'), h('span', { class: 'muted' }, w.fuelDays + ' days logged')),
      h('div', { class: 'dots' }, w.met.map((m, i) => h('i', { class: m === true ? 'met' : m === false ? 'miss' : '', title: w.days[i] }))),
      h('div', { class: 'chart-labels' }, w.days.map(d => h('span', {}, PT.dayName(d).slice(0, 2)))),
      h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Green = all macros within 10% of that day\'s goal · red outline = logged but off · grey = not logged')),
    h('h2', {}, 'Strength bests'),
    lifts.length ? h('div', { class: 'card' }, lifts.map(n => {
      const now = heaviest(w.logs, n), prev = heaviest(last.logs, n), ever = heaviest(w.before, n);
      const series = PT.state.logs.filter(l => l.date < PT.addDays(pWeek, 7)).sort((a, b) => a.date < b.date ? -1 : 1).map(l => heaviest([l], n)).filter(Boolean).slice(-10).map(y => ({ y }));
      return h('div', { style: { padding: '8px 0', borderBottom: '1px solid var(--line)' } },
        h('div', { class: 'row between' }, h('b', {}, n), h('span', {}, h('b', {}, now + ' kg'),
          prev ? h('span', { class: now > prev ? 'ok' : now < prev ? 'red' : 'muted', style: { fontWeight: 800 } }, '  ' + (now > prev ? '▲ +' + PT.r1(now - prev) : now < prev ? '▼ ' + PT.r1(now - prev) : '= ') + ' kg') : null)),
        h('div', { class: 'small muted' }, ever && now > ever ? 'New personal best' : ever ? 'Best before this week: ' + ever + ' kg' : 'First time logged'),
        series.length > 1 ? PT.spark(series) : null);
    })) : h('div', { class: 'empty' }, 'Log weights this week to see your strength bests.'));
};

/* ---------- progress & goals ---------- */
const PRESETS = [
  ['Marathon distance (longest run)', 'km'], ['Triathlon milestones', 'milestones'],
  ['Full body strength (e.g. squat)', 'kg'], ['Martial arts skills', 'skills'], ['Body weight', 'kg']
];
function goalInfo(g) {
  const cur = g.history.length ? g.history[g.history.length - 1].value : g.start;
  const span = g.target - g.start, frac = span ? (cur - g.start) / span : 1;
  const f = Math.max(0, Math.min(1, frac));
  let status = 'No deadline', cls = 'muted';
  if (frac >= 1) { status = 'Reached'; cls = 'ok'; }
  else if (g.deadline) {
    const total = PT.daysBetween(g.created, g.deadline), elapsed = PT.daysBetween(g.created, PT.today());
    if (elapsed > total) { status = 'Past deadline'; cls = 'red'; }
    else { const exp = total > 0 ? elapsed / total : 1; if (frac >= exp - 0.05) { status = 'On track'; cls = 'ok'; } else { status = 'Behind pace'; cls = 'warn'; } }
  }
  return { cur, f, status, cls };
}

PT.moreViews.progress = function () {
  const s = PT.state, root = h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Progress'), h('h2', {}, 'Goals'));
  if (!s.goals.length) root.append(h('div', { class: 'empty' }, 'Set a goal with a start and target number, then update it as you improve. The app tells you if you’re on pace.'));
  s.goals.forEach(g => {
    const i = goalInfo(g);
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, g.title), h('span', { class: i.cls, style: { fontWeight: '800' } }, i.status)),
      h('div', { class: 'small muted' }, 'Start ' + g.start + ' → target ' + g.target + ' ' + g.unit + (g.deadline ? ' by ' + PT.niceDate(g.deadline) : '')),
      h('div', { class: 'bar' + (i.status === 'Reached' ? ' ok' : '') }, h('i', { style: { width: (i.f * 100) + '%' } })),
      h('div', { class: 'row between' }, h('b', {}, 'Now: ' + i.cur + ' ' + g.unit), h('span', { class: 'muted small' }, Math.round(i.f * 100) + '%')),
      g.history.length > 1 ? PT.spark(g.history.map(p => ({ y: p.value }))) : null,
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn small grow', onclick: () => updateGoal(g) }, 'Update'),
        h('button', { class: 'btn ghost small', onclick: () => goalForm(g) }, 'Edit'))));
  });
  root.append(h('button', { class: 'btn ghost block', onclick: () => goalForm(null) }, '+ New goal'));

  // training stats from logs
  const weeks = []; let w = PT.weekStart(PT.today());
  for (let k = 0; k < 8; k++) { weeks.unshift(w); w = PT.addDays(w, -7); }
  const inWeek = (d, ws) => d >= ws && d < PT.addDays(ws, 7);
  const counts = weeks.map(ws => s.logs.filter(l => inWeek(l.date, ws)).length);
  const runKm = weeks.map(ws => PT.r1(s.logs.filter(l => inWeek(l.date, ws)).reduce((a, l) => a + l.exercises.reduce((b, e) => b + (e.kind === 'cardio' && e.unit === 'km' && (e.sport === 'run' || (!e.sport && l.type === 'run')) ? +e.distance || 0 : 0), 0), 0)));
  const labels = weeks.map(x => String(PT.parse(x).getDate()));
  root.append(h('h2', {}, 'Sessions per week'), h('div', { class: 'card' }, PT.bars(counts, labels, 'Last 8 weeks (week starting on that date). ' + s.logs.length + ' sessions logged in total.')),
    h('h2', {}, 'Run distance per week (km)'), h('div', { class: 'card' }, PT.bars(runKm, labels, 'Highest week: ' + Math.max(0, ...runKm) + ' km')));

  // strength PBs and trend
  const best = {};
  s.logs.slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(l => l.exercises.forEach(e => {
    if (e.kind === 'cardio' || !+e.kg) return;
    const b = best[e.name] || (best[e.name] = { first: +e.kg, max: +e.kg, series: {} });
    b.max = Math.max(b.max, +e.kg); b.series[l.date] = Math.max(b.series[l.date] || 0, +e.kg);
  }));
  const names = Object.keys(best);
  root.append(h('h2', {}, 'Strength'));
  if (!names.length) root.append(h('div', { class: 'empty' }, 'Log sessions with weights to see your personal bests and trends.'));
  else {
    const box = h('div', { class: 'card' });
    const draw = name => {
      const b = best[name], pts = Object.keys(b.series).sort().map(d => ({ y: b.series[d] }));
      PT.fill(box, h('select', { onchange: e => draw(e.target.value) }, names.map(n => h('option', { value: n, selected: n === name }, n))),
        h('div', { class: 'row between', style: { marginTop: '10px' } }, h('div', { class: 'stat' }, b.max + ' kg'), h('div', { class: b.max > b.first ? 'ok' : 'muted', style: { fontWeight: '800' } }, b.max > b.first ? '+' + PT.r1(b.max - b.first) + ' kg since first log' : 'First log: ' + b.first + ' kg')),
        PT.spark(pts), h('div', { class: 'small muted' }, 'Heaviest set per day across ' + pts.length + ' sessions'));
    };
    draw(names[0]); root.append(box);
  }
  return root;
};

function updateGoal(g) {
  let v = goalInfo(g).cur;
  const sh = PT.sheet('Update: ' + g.title, h('div', {}, PT.field('Where are you now? (' + g.unit + ')', PT.numInput(v, x => v = x)), gap(12),
    h('button', { class: 'btn block', onclick: () => {
      if (v === '' || isNaN(v)) { PT.toast('Enter a number'); return; }
      g.history.push({ date: PT.today(), value: +v }); PT.save(); sh.close(); PT.render();
    } }, 'Save progress')));
}

function goalForm(goal) {
  const d = goal ? JSON.parse(JSON.stringify(goal)) : { id: PT.uid(), title: '', unit: '', start: '', target: '', deadline: '', created: PT.today(), history: [] };
  const box = h('div', {});
  function draw() {
    PT.fill(box,
      goal ? null : h('div', {}, h('p', { class: 'small muted' }, 'Quick start (you set the numbers):'), PT.chips(PRESETS.map(p => [p[0], p[0]]), [], () => {}), null),
      PT.field('Goal', h('input', { value: d.title, placeholder: 'e.g. Marathon distance', oninput: e => d.title = e.target.value })), gap(10),
      h('div', { class: 'grid3' }, PT.field('Unit', h('input', { value: d.unit, placeholder: 'km', oninput: e => d.unit = e.target.value })),
        PT.field('Start', PT.numInput(d.start, v => d.start = v)), PT.field('Target', PT.numInput(d.target, v => d.target = v))), gap(10),
      PT.field('Deadline (optional)', h('input', { type: 'date', value: d.deadline || '', oninput: e => d.deadline = e.target.value })), gap(12),
      h('button', { class: 'btn block', onclick: () => {
        if (!d.title.trim() || d.start === '' || d.target === '') { PT.toast('Add a title, start and target'); return; }
        d.title = d.title.trim(); d.unit = d.unit.trim();
        const i = PT.state.goals.findIndex(x => x.id === d.id); if (i >= 0) PT.state.goals[i] = d; else PT.state.goals.push(d);
        PT.save(); sh.close(); PT.render();
      } }, 'Save goal'),
      goal ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete this goal and its history?', 'Delete', () => { PT.state.goals = PT.state.goals.filter(x => x.id !== goal.id); PT.save(); PT.render(); }) }, 'Delete goal')) : null);
    if (!goal) { // preset chips fill the title and unit
      const chipWrap = box.querySelector('.chip') && box.querySelector('.chip').parentNode;
      if (chipWrap) [...chipWrap.children].forEach((c, i) => c.addEventListener('click', () => { d.title = PRESETS[i][0]; d.unit = PRESETS[i][1]; draw(); }));
    }
  }
  const sh = PT.sheet(goal ? 'Edit goal' : 'New goal', box);
  draw();
}
})();
