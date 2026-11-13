(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });
PT.moreViews = {};

PT.views.more = function (parts) {
  const v = parts[1] && PT.moreViews[parts[1]];
  if (v) return v(parts);
  const items = [['progress', 'Progress & goals'], ['sleep', 'Sleep'], ['mind', 'Meditation'], ['exercises', 'Exercise library'], ['code', 'Your code (motivation)'], ['settings', 'Settings & backup']];
  return h('div', {}, h('h1', {}, 'More'), h('div', { class: 'menu' }, items.map(([k, l]) => h('a', { href: '#/more/' + k }, l, h('span', {}, '›')))));
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
  const runKm = weeks.map(ws => PT.r1(s.logs.filter(l => l.type === 'run' && inWeek(l.date, ws)).reduce((a, l) => a + l.exercises.reduce((b, e) => b + (e.kind === 'cardio' && e.unit === 'km' ? +e.distance || 0 : 0), 0), 0)));
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
