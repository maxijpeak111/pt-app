(function () {
'use strict';
const PT = window.PT, h = PT.h;
const gap = px => h('div', { style: { height: px + 'px' } });

/* ---------- sleep ---------- */
PT.moreViews.sleep = function () {
  const s = PT.state, d = { date: PT.today(), hours: '', quality: 3, note: '' };
  const last = [...Array(14)].map((_, i) => PT.addDays(PT.today(), -13 + i));
  const hrs = last.map(x => (s.sleep[x] ? +s.sleep[x].hours || 0 : 0));
  const logged = hrs.filter(Boolean), avg = logged.length ? PT.r1(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const form = h('div', { class: 'card' },
    h('div', { class: 'grid2' }, PT.field('Night of', h('input', { type: 'date', value: d.date, oninput: e => d.date = e.target.value })), PT.field('Hours slept', PT.numInput(d.hours, v => d.hours = v, '7.5', '0.25'))),
    gap(10), h('label', { class: 'f' }, 'How rested do you feel?'), PT.seg([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 3, v => d.quality = v), gap(10),
    PT.field('Note (optional)', h('input', { oninput: e => d.note = e.target.value })), gap(12),
    h('button', { class: 'btn block', onclick: () => {
      if (d.hours === '' || !(d.hours > 0 && d.hours <= 24)) { PT.toast('Enter hours slept'); return; }
      s.sleep[d.date] = { hours: d.hours, quality: d.quality, note: d.note }; PT.save(); PT.toast('Saved'); PT.render();
    } }, 'Save sleep'));
  const recent = Object.keys(s.sleep).sort().reverse().slice(0, 10);
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Sleep'), form,
    h('h2', {}, 'Last 14 nights'), h('div', { class: 'card' }, PT.bars(hrs, last.map(x => String(PT.parse(x).getDate())), logged.length ? 'Average ' + avg + ' h over ' + logged.length + ' logged nights' : 'Nothing logged yet.')),
    h('h2', {}, 'Recent'),
    recent.length ? recent.map(k => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('b', {}, PT.niceDate(k)), h('span', {}, s.sleep[k].hours + ' h · rested ' + s.sleep[k].quality + '/5')),
      s.sleep[k].note ? h('div', { class: 'small muted' }, s.sleep[k].note) : null)) : h('div', { class: 'empty' }, 'No entries yet.'));
};

/* ---------- meditation ---------- */
const timer = { target: 600, running: false, startedAt: 0, accum: 0, iv: null };
const elapsed = () => timer.accum + (timer.running ? (Date.now() - timer.startedAt) / 1000 : 0);
function logMind(mins, type) {
  const day = PT.today(); (PT.state.mind[day] = PT.state.mind[day] || []).push({ id: PT.uid(), minutes: mins, type: type || 'Meditation' });
  PT.save();
}
PT.moreViews.mind = function () {
  const s = PT.state, disp = h('div', { class: 'timer' });
  const startBtn = h('button', { class: 'btn grow' }, '');
  function tick() {
    if (!disp.isConnected) { clearInterval(timer.iv); return; }
    const left = Math.max(0, Math.ceil(timer.target - elapsed()));
    disp.textContent = PT.fmtDur(left) || '0:00';
    startBtn.textContent = timer.running ? 'Pause' : (timer.accum ? 'Resume' : 'Start');
    if (timer.running && left === 0) {
      timer.running = false; clearInterval(timer.iv); logMind(Math.round(timer.target / 60), 'Timer'); timer.accum = 0;
      PT.toast('Done. Logged ' + Math.round(timer.target / 60) + ' min'); PT.render();
    }
  }
  startBtn.addEventListener('click', () => {
    if (timer.running) { timer.accum = elapsed(); timer.running = false; }
    else { timer.startedAt = Date.now(); timer.running = true; }
    tick();
  });
  clearInterval(timer.iv); timer.iv = setInterval(tick, 500);
  const days = Object.keys(s.mind).sort().reverse();
  let streak = 0; for (let k = 0; ; k++) { if ((s.mind[PT.addDays(PT.today(), -k)] || []).length) streak++; else if (k > 0) break; else if (k === 0) continue; if (k > 400) break; }
  const wk = PT.weekStart(PT.today()); let weekMin = 0;
  for (let k = 0; k < 7; k++) (s.mind[PT.addDays(wk, k)] || []).forEach(e => weekMin += +e.minutes || 0);
  const manual = { minutes: '', type: 'Meditation' };
  const root = h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Meditation'),
    h('div', { class: 'card' },
      PT.seg([[300, '5'], [600, '10'], [900, '15'], [1200, '20']], timer.target, v => { if (!timer.running && !timer.accum) { timer.target = v; tick(); } else PT.toast('Reset the timer first'); }),
      disp,
      h('div', { class: 'row' }, startBtn,
        h('button', { class: 'btn ghost', onclick: () => { const m = Math.floor(elapsed() / 60); timer.running = false; timer.accum = 0; if (m >= 1) { logMind(m, 'Timer'); PT.toast('Logged ' + m + ' min'); } PT.render(); } }, 'Stop & log')),
      h('p', { class: 'small muted' }, 'Keep the app open while the timer runs. It logs itself when it finishes.')),
    h('div', { class: 'row', style: { margin: '12px 0' } },
      h('div', { class: 'card grow' }, h('div', { class: 'stat' }, weekMin), h('div', { class: 'small muted' }, 'min this week')),
      h('div', { class: 'card grow' }, h('div', { class: 'stat' }, streak), h('div', { class: 'small muted' }, 'day streak'))),
    h('h2', {}, 'Log a session manually'),
    h('div', { class: 'card' }, h('div', { class: 'grid2' }, PT.field('Minutes', PT.numInput('', v => manual.minutes = v, '10', '1')),
      PT.field('Type', h('select', { onchange: e => manual.type = e.target.value }, ['Meditation', 'Breathwork', 'Body scan', 'Stretch & breathe', 'Other'].map(t => h('option', { value: t }, t))))), gap(10),
      h('button', { class: 'btn block', onclick: () => { if (!(manual.minutes > 0)) { PT.toast('Enter minutes'); return; } logMind(manual.minutes, manual.type); PT.toast('Logged'); PT.render(); } }, 'Log it')),
    h('h2', {}, 'Recent'));
  const rec = days.slice(0, 7);
  if (!rec.length) root.append(h('div', { class: 'empty' }, 'Nothing logged yet.'));
  rec.forEach(k => root.append(h('div', { class: 'card' }, h('b', {}, PT.niceDate(k)),
    s.mind[k].map(e => h('div', { class: 'row between small' }, h('span', {}, e.type + ' · ' + e.minutes + ' min'),
      h('button', { class: 'btn danger small', onclick: () => { s.mind[k] = s.mind[k].filter(x => x.id !== e.id); PT.save(); PT.render(); } }, '✕'))))));
  tick();
  return root;
};

/* ---------- exercise library ---------- */
function safeUrl(u) { u = (u || '').trim(); return (/^https?:\/\//i.test(u) || /^[\w./-]+$/.test(u)) ? u : ''; }
PT.moreViews.exercises = function (parts) {
  if (parts[2]) return exDetail(parts[2]);
  const s = PT.state, q = { v: '' }, list = h('div', {});
  const draw = () => {
    const rows = s.exercises.filter(e => e.name.toLowerCase().includes(q.v.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(...(rows.length ? rows.map(e => h('a', { class: 'card tap', href: '#/more/exercises/' + e.id },
      h('div', { class: 'row between' }, h('b', {}, e.name), e.link ? h('span', { class: 'pill done' }, 'media') : null),
      h('div', { class: 'small muted' }, e.muscles.map(PT.tagLabel).join(', ') + (PT.hasRange(e) ? ' · range set' : '')))) : [h('div', { class: 'empty' }, 'No matches.')]));
  };
  draw();
  return h('div', {}, PT.back('#/more', 'More'), h('h1', {}, 'Exercises'),
    h('div', { class: 'row', style: { marginBottom: '12px', flexWrap: 'nowrap' } }, h('input', { placeholder: 'Search', oninput: e => { q.v = e.target.value; draw(); } }),
      h('button', { class: 'btn small', onclick: () => { const e = { id: PT.uid(), name: '', muscles: [], kind: 'strength', notes: '', link: '' }; s.exercises.push(e); PT.save(); location.hash = '#/more/exercises/' + e.id; } }, '+ New')),
    list);
};
function exDetail(id) {
  const s = PT.state, e = s.exercises.find(x => x.id === id);
  if (!e) return h('div', {}, PT.back('#/more/exercises', 'Exercises'), h('div', { class: 'empty' }, 'Not found.'));
  const media = h('div', {});
  const drawMedia = () => {
    const u = safeUrl(e.link); media.replaceChildren();
    if (!u) return;
    if (/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(u)) media.append(h('video', { src: u, controls: true, playsinline: true, style: { width: '100%', borderRadius: '12px', marginTop: '10px' } }));
    else if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(u)) media.append(h('img', { src: u, alt: e.name, style: { width: '100%', borderRadius: '12px', marginTop: '10px' } }));
    else media.append(h('a', { class: 'btn ghost block', style: { marginTop: '10px' }, href: u, target: '_blank', rel: 'noopener' }, 'Open demo ↗'));
  };
  drawMedia();
  return h('div', {}, PT.back('#/more/exercises', 'Exercises'), h('h1', {}, e.name || 'New exercise'),
    PT.field('Name', h('input', { value: e.name, oninput: ev => e.name = ev.target.value, onchange: () => PT.save() })), gap(10),
    h('label', { class: 'f' }, 'Folders (muscles / sport)'), PT.chips(PT.TAGS, e.muscles, () => PT.save()), gap(10),
    h('h2', {}, 'Your range'),
    h('div', { class: 'card' },
      PT.hasRange(e) ? [h('div', {}, h('span', { class: 'muted small' }, 'Level 1  '), PT.exText(PT.atLevel(e, 1))), h('div', {}, h('span', { class: 'muted small' }, 'Level 5  '), PT.exText(PT.atLevel(e, 5))), h('div', {}, h('span', { class: 'red small' }, 'Level 10  '), PT.exText(PT.atLevel(e, 10)))]
        : h('div', { class: 'small muted' }, 'Not set. Optional: it gives you a suggested target. What you actually lift or swim is what gets tracked.'),
      gap(8), h('button', { class: 'btn ghost small block', onclick: () => { const box = h('div', {}); const sh = PT.sheet('Your range: ' + (e.name || 'exercise'), box); PT.rangeForm(box, e, () => { sh.close(); PT.render(); }); } }, PT.hasRange(e) ? 'Change my range' : 'Set my range')), gap(10),
    PT.field('Technique notes', h('textarea', { value: e.notes || '', oninput: ev => e.notes = ev.target.value, onchange: () => PT.save() })), gap(10),
    PT.field('Demo video or image link', h('input', { value: e.link || '', placeholder: 'https://… or media/squat.mp4', oninput: ev => e.link = ev.target.value, onchange: () => { PT.save(); drawMedia(); } })),
    h('p', { class: 'small muted' }, 'Paste a link, or add your own video file to the docs/media folder on GitHub and use media/yourfile.mp4.'),
    media, gap(18),
    h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete "' + (e.name || 'this exercise') + '"?', 'Delete', () => { s.exercises = s.exercises.filter(x => x.id !== e.id); PT.save(); location.hash = '#/more/exercises'; }) }, 'Delete exercise'));
}
})();
