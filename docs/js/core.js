(function () {
'use strict';
const PT = window.PT = { views: {} };

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
PT.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
PT.dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
PT.today = () => PT.dstr(new Date());
PT.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
PT.addDays = (s, n) => { const d = PT.parse(s); d.setDate(d.getDate() + n); return PT.dstr(d); };
PT.weekStart = s => { const d = PT.parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return PT.dstr(d); };
PT.dayName = s => DAYS[PT.parse(s).getDay()];
PT.niceDate = s => { const d = PT.parse(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
PT.daysBetween = (a, b) => Math.round((PT.parse(b) - PT.parse(a)) / 86400000);

/* ---------- state ---------- */
const KEY = 'pt.v1';
function defaults() {
  return {
    v: 1, seeded: false,
    settings: { minPct: 60, maxPct: 110, bodyKg: '', targets: { kcal: '', p: '', c: '', f: '' }, hardKcal: '', ownOnly: false },
    sessions: [], plan: {}, logs: [], goals: [], customStretches: [], recoveryLog: {},
    foods: [], meals: [], foodLog: {}, sleep: {}, mind: {}, exercises: [], quotes: [], principles: ''
  };
}
function merge(d, o) {
  const s = Object.assign({}, d.settings, o.settings || {});
  s.targets = Object.assign({}, d.settings.targets, (o.settings || {}).targets || {});
  return Object.assign(d, o, { settings: s });
}
function load() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(d, JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); }
  return d;
}
PT.state = load();
PT.save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(PT.state)); return true; }
  catch (e) { alert('Could not save. Storage may be full or blocked in this browser.'); return false; }
};
PT.replaceState = obj => { PT.state = merge(defaults(), obj); PT.save(); if (PT.migrate) PT.migrate(); };
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

/* ---------- tiny DOM helper (text is always inserted as text, never HTML) ---------- */
const PROPS = new Set(['value', 'checked', 'selected', 'disabled']);
PT.h = function (tag, props, ...kids) {
  const el = document.createElement(tag);
  const later = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) later.push([k, v]);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  for (const [k, v] of later) el[k] = v;
  return el;
};
const h = PT.h;
// Replace an element's children, flattening arrays and skipping null/false (replaceChildren would print them as text).
PT.fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false).map(k => k.nodeType ? k : document.createTextNode(String(k))));

/* ---------- sheets, toasts ---------- */
PT.sheet = function (title, content) {
  const root = document.getElementById('modal');
  const close = () => { root.replaceChildren(); document.body.classList.remove('noscroll'); };
  root.replaceChildren(
    h('div', { class: 'backdrop', onclick: close }),
    h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h3', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'sheet-body' }, content))
  );
  document.body.classList.add('noscroll');
  return { close };
};
PT.confirm = function (msg, yesLabel, onYes) {
  const s = PT.sheet('Are you sure?', h('div', {},
    h('p', {}, msg),
    h('div', { class: 'row', style: { marginTop: '14px' } },
      h('button', { class: 'btn ghost grow', onclick: () => s.close() }, 'Cancel'),
      h('button', { class: 'btn grow', onclick: () => { s.close(); onYes(); } }, yesLabel || 'Yes'))));
};
PT.toast = m => { const t = h('div', { class: 'toast' }, m); document.body.append(t); setTimeout(() => t.remove(), 1700); };

/* ---------- reusable inputs ---------- */
PT.fmtDur = s => {
  s = Math.round(+s || 0); if (!s) return '';
  const hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return hh ? hh + ':' + pad(m) + ':' + pad(r) : m + ':' + pad(r);
};
PT.digitsToSec = d => {
  d = String(d).replace(/\D/g, '').slice(0, 6); if (!d) return 0;
  return (+(d.slice(0, -4) || 0)) * 3600 + (+(d.slice(-4, -2) || 0)) * 60 + (+d.slice(-2));
};
// type digits only: 530 becomes 5:30 (the iPhone number pad has no colon)
PT.durInput = (sec, onChange, ph) => {
  const inp = h('input', { type: 'text', inputmode: 'numeric', placeholder: ph || 'm:ss', value: PT.fmtDur(sec) });
  inp.addEventListener('input', () => { const s = PT.digitsToSec(inp.value); inp.value = PT.fmtDur(s); onChange(s); });
  return inp;
};
PT.numInput = (val, onChange, ph, step) => {
  const inp = h('input', { type: 'number', inputmode: 'decimal', step: step || 'any', placeholder: ph || '', value: val === '' || val == null ? '' : val });
  inp.addEventListener('input', () => onChange(inp.value === '' ? '' : +inp.value));
  return inp;
};
PT.field = (label, input) => h('div', {}, h('label', { class: 'f' }, label), input);
PT.seg = (options, value, onChange) => {
  const wrap = h('div', { class: 'seg' });
  options.forEach(([val, label]) => {
    const b = h('button', { type: 'button', class: val === value ? 'on' : '' }, label);
    b.addEventListener('click', () => { [...wrap.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); onChange(val); });
    wrap.append(b);
  });
  return wrap;
};
PT.chips = (options, selected, onChange) => {
  const wrap = h('div', {});
  options.forEach(([val, label]) => {
    const c = h('span', { class: 'chip' + (selected.includes(val) ? ' on' : '') }, label);
    c.addEventListener('click', () => {
      const i = selected.indexOf(val);
      if (i >= 0) selected.splice(i, 1); else selected.push(val);
      c.classList.toggle('on', selected.includes(val));
      onChange(selected);
    });
    wrap.append(c);
  });
  return wrap;
};
PT.bars = (values, labels, note) => {
  const max = Math.max(1, ...values);
  return h('div', {},
    h('div', { class: 'chart' }, values.map(v => h('div', { style: { height: (v / max * 100) + '%' }, title: String(v) }))),
    h('div', { class: 'chart-labels' }, labels.map(l => h('span', {}, l))),
    note ? h('div', { class: 'small muted', style: { marginTop: '6px' } }, note) : null);
};
PT.spark = points => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'spark'); svg.setAttribute('viewBox', '0 0 100 40'); svg.setAttribute('preserveAspectRatio', 'none');
  if (points.length < 2) return svg;
  const ys = points.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const d = points.map((p, i) => (i / (points.length - 1) * 100).toFixed(1) + ',' + (36 - (p.y - min) / span * 32).toFixed(1)).join(' ');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', d); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#dc2626');
  line.setAttribute('stroke-width', '2'); line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);
  return svg;
};
PT.back = (href, label) => h('a', { class: 'back', href }, '‹ ' + (label || 'Back'));

/* ---------- sessions, intensity ---------- */
PT.TYPES = [['strength', 'Strength'], ['run', 'Run'], ['swim', 'Swim'], ['bike', 'Bike'], ['mma', 'MMA'], ['other', 'Mixed']];
PT.typeLabel = t => (PT.TYPES.find(x => x[0] === t) || [0, 'Other'])[1];
PT.TAGS = [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'], ['legs', 'Legs'], ['core', 'Core'], ['run', 'Running'], ['swim', 'Swimming'], ['bike', 'Cycling'], ['mma', 'MMA'], ['full', 'Full body']];
/* Folders for browsing exercises when building a session. Each folder shows library exercises with that tag. */
PT.FOLDERS = [
  ['Strength', [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'], ['legs', 'Legs'], ['core', 'Core'], ['full', 'Full body']]],
  ['Cardio', [['run', 'Run'], ['swim', 'Swim'], ['bike', 'Bike']]],
  ['Combat', [['mma', 'MMA']]]
];
PT.KINDS = [['strength', 'Sets × reps × kg'], ['cardio', 'Distance + time'], ['time', 'Time / rounds']];
PT.tagLabel = t => (PT.TAGS.find(x => x[0] === t) || [0, t])[1];
PT.defaultTags = { strength: [], run: ['run', 'legs'], swim: ['swim', 'shoulders', 'back'], bike: ['bike', 'legs'], mma: ['mma', 'full'], other: [] };
PT.defaultKind = t => (t === 'run' || t === 'swim') ? 'cardio' : 'strength';
PT.defaultUnit = t => t === 'swim' ? 'm' : 'km';
PT.newEx = type => ({ id: PT.uid(), name: '', kind: PT.defaultKind(type), sets: 3, reps: 10, kg: '', distance: '', unit: PT.defaultUnit(type), pace: 0, time: 0, notes: '' });
PT.exText = ex => {
  if (ex.kind === 'time') return [+ex.rounds ? ex.rounds + ' rounds' : null, +ex.time ? PT.fmtDur(ex.time) + (+ex.rounds ? ' each' : '') : null].filter(Boolean).join(' × ') || '—';
  if (ex.kind === 'cardio') {
    const p = [];
    if (+ex.distance) p.push(ex.distance + ' ' + ex.unit);
    if (+ex.pace) p.push(PT.fmtDur(ex.pace) + (ex.unit === 'm' ? '/100m' : '/km'));
    if (+ex.time) p.push(PT.fmtDur(ex.time));
    return p.join(' · ') || '—';
  }
  return (ex.sets || '?') + '×' + (ex.reps || '?') + (+ex.kg ? ' @ ' + ex.kg + ' kg' : '');
};
// Intensity 1 to 10 maps linearly between your own min % and max % of the base session.
PT.factor = i => {
  const s = PT.state.settings, min = +s.minPct || 60, max = +s.maxPct || 110;
  return (min + (max - min) * ((i - 1) / 9)) / 100;
};
PT.pct = i => Math.round(PT.factor(i) * 100);
PT.scaleEx = (ex, i) => {
  const f = PT.factor(i), o = Object.assign({}, ex);
  if (ex.kind === 'cardio') {
    if (+ex.distance) o.distance = ex.unit === 'm' ? Math.round(ex.distance * f / 25) * 25 : Math.round(ex.distance * f * 10) / 10;
    if (+ex.time) o.time = Math.round(ex.time * f / 10) * 10;
    else if (+o.distance && +ex.pace) o.time = Math.round((ex.unit === 'm' ? o.distance / 100 : o.distance) * ex.pace);
  } else if (+ex.kg) o.kg = Math.round(ex.kg * f / 2.5) * 2.5;
  return o;
};
PT.session = id => PT.state.sessions.find(x => x.id === id);

/* ---------- your own range per exercise: warm-up (level 1) to max (level 10) ---------- */
PT.libEx = ex => ex && ((ex.exId && PT.state.exercises.find(x => x.id === ex.exId)) ||
  (ex.name && PT.state.exercises.find(x => x.name.trim().toLowerCase() === String(ex.name).trim().toLowerCase())));
PT.hasRange = lib => !!(lib && lib.range && lib.range.min && lib.range.max);
const lerp = (a, b, t) => (+a || 0) + ((+b || 0) - (+a || 0)) * t;
PT.sportOf = lib => lib ? (['run', 'swim', 'bike'].find(t => (lib.muscles || []).includes(t)) || '') : '';
// What to do at a given level, worked out from your range. Returns the same shape the logger uses.
PT.atLevel = (lib, level) => {
  const t = (Math.min(10, Math.max(1, +level || 1)) - 1) / 9, mn = lib.range.min, mx = lib.range.max;
  const o = { id: PT.uid(), exId: lib.id, name: lib.name, kind: lib.kind || 'strength', sport: PT.sportOf(lib), sets: '', reps: '', kg: '', distance: '', unit: lib.unit || 'km', pace: 0, time: 0, rounds: '', notes: '' };
  if (o.kind === 'strength') {
    o.sets = Math.round(lerp(mn.sets, mx.sets, t)); o.reps = Math.round(lerp(mn.reps, mx.reps, t));
    const kg = lerp(mn.kg, mx.kg, t); o.kg = kg ? Math.round(kg / 2.5) * 2.5 : '';
  } else if (o.kind === 'cardio') {
    const d = lerp(mn.distance, mx.distance, t);
    o.distance = d ? (o.unit === 'm' ? Math.round(d / 25) * 25 : Math.round(d * 10) / 10) : '';
    const tm = lerp(mn.time, mx.time, t); o.time = tm ? Math.round(tm / 5) * 5 : 0;
    if (+o.distance && o.time) o.pace = Math.round(o.time / (o.unit === 'm' ? o.distance / 100 : o.distance));
  } else {
    o.rounds = Math.round(lerp(mn.rounds, mx.rounds, t)) || '';
    const tm = lerp(mn.time, mx.time, t); o.time = tm ? Math.round(tm / 5) * 5 : 0;
  }
  return o;
};
// Target for an exercise in a session at a level: uses your range if set, otherwise scales what was written.
PT.target = (ex, level) => {
  const lib = PT.libEx(ex);
  if (PT.hasRange(lib)) { const o = PT.atLevel(lib, level); o.id = ex.id; return o; }
  const o = PT.scaleEx(ex, level); o.sport = o.sport || PT.sportOf(lib); return o;
};
// Level for one exercise on a planned day (your per-day change, else the level saved in the session).
PT.levelOf = (item, ex) => (item && item.levels && item.levels[ex.id]) || ex.level || (item && item.intensity) || 7;
PT.itemLevel = (item, s) => {
  if (!s || !s.exercises.length) return (item && item.intensity) || 7;
  return Math.round(s.exercises.reduce((a, e) => a + PT.levelOf(item, e), 0) / s.exercises.length);
};

/* ---------- nutrition maths ---------- */
// Food macros are stored for one usual portion; qty is how many portions (0.5, 1, 2…).
PT.macrosOf = (food, qty) => ({ kcal: food.kcal * qty, p: food.p * qty, c: food.c * qty, f: food.f * qty });
PT.sumMacros = list => list.reduce((a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.p || 0), c: a.c + (+m.c || 0), f: a.f + (+m.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
PT.mealTotals = meal => PT.sumMacros(meal.items.map(it => { const f = PT.state.foods.find(x => x.id === it.foodId); return f ? PT.macrosOf(f, +it.qty || 0) : { kcal: 0, p: 0, c: 0, f: 0 }; }));
PT.r1 = n => Math.round(n * 10) / 10;

/* ---------- built-in stretch library (general guidance; skip anything that hurts) ---------- */
PT.STRETCHES = [
  { id: 's-doorway-chest', name: 'Doorway chest stretch', tags: ['chest', 'swim', 'mma'], hold: '30s each side', how: 'Forearm on a door frame, elbow at shoulder height. Step through until the front of the chest opens.' },
  { id: 's-cross-body', name: 'Cross-body shoulder stretch', tags: ['shoulders', 'chest', 'swim'], hold: '30s each side', how: 'Pull one arm across the chest with the other hand. Keep the shoulder down.' },
  { id: 's-overhead-tri', name: 'Overhead triceps stretch', tags: ['arms', 'shoulders', 'swim'], hold: '30s each side', how: 'Elbow up by your ear, hand down the back, press the elbow gently with the other hand.' },
  { id: 's-wrist', name: 'Wrist flexor and extensor stretch', tags: ['arms', 'mma'], hold: '20s each way', how: 'Arm straight, palm up then palm down, gently draw the fingers back with the other hand.' },
  { id: 's-neck', name: 'Neck side tilt', tags: ['shoulders', 'mma', 'swim'], hold: '20s each side', how: 'Ear toward shoulder with relaxed shoulders. Light pressure only.' },
  { id: 's-childs', name: "Child's pose", tags: ['back', 'shoulders', 'core', 'full'], hold: '45s', how: 'Knees wide, hips back toward the heels, arms reaching forward. Breathe into the back.' },
  { id: 's-catcow', name: 'Cat-cow', tags: ['back', 'core', 'full'], hold: '10 slow reps', how: 'On all fours, round the spine then lift chest and tailbone, moving with the breath.' },
  { id: 's-thread', name: 'Thread the needle', tags: ['back', 'shoulders', 'swim', 'mma'], hold: '30s each side', how: 'From all fours slide one arm under the other, resting shoulder and ear on the floor.' },
  { id: 's-twist', name: 'Seated spinal twist', tags: ['back', 'core', 'mma', 'run'], hold: '30s each side', how: 'Sit tall, cross one leg over, turn toward the bent knee and hug it with the opposite elbow.' },
  { id: 's-lat', name: 'Kneeling lat stretch', tags: ['back', 'shoulders', 'swim'], hold: '30s', how: 'Hands on a bench or chair, sit the hips back and drop the chest toward the floor.' },
  { id: 's-cobra', name: 'Cobra (prone press-up)', tags: ['core', 'back'], hold: '20s', how: 'Face down, press the chest up with hips on the floor. Stop if the lower back pinches.' },
  { id: 's-quad', name: 'Standing quad stretch', tags: ['legs', 'run'], hold: '30s each side', how: 'Heel to glute, knees together, hips tucked slightly under. Hold a wall for balance.' },
  { id: 's-hamstring', name: 'Hamstring stretch', tags: ['legs', 'run', 'mma'], hold: '30s each side', how: 'Heel out in front, toes up, hinge from the hips with a flat back.' },
  { id: 's-hipflexor', name: 'Kneeling hip flexor stretch', tags: ['legs', 'run', 'core'], hold: '30s each side', how: 'Back knee down, squeeze the back-leg glute, shift the hips forward.' },
  { id: 's-fig4', name: 'Figure-four glute stretch', tags: ['legs', 'run', 'mma'], hold: '30s each side', how: 'On your back, ankle over the opposite knee, draw the thigh toward you.' },
  { id: 's-calf', name: 'Standing calf stretch', tags: ['legs', 'run'], hold: '30s each side', how: 'Hands on a wall, back leg straight, heel down, lean forward.' },
  { id: 's-soleus', name: 'Bent-knee calf stretch', tags: ['legs', 'run'], hold: '30s each side', how: 'Same as the calf stretch with the back knee bent to reach the lower calf.' },
  { id: 's-butterfly', name: 'Butterfly (adductor) stretch', tags: ['legs', 'mma'], hold: '45s', how: 'Soles of the feet together, knees falling out, sit tall.' },
  { id: 's-forwardfold', name: 'Standing forward fold', tags: ['full', 'legs', 'back'], hold: '30s', how: 'Soft knees, hang from the hips and let head and arms drop. Roll up slowly.' },
  { id: 's-breath', name: 'Box breathing', tags: ['full'], hold: '1 min', how: 'In for 4, hold 4, out 4, hold 4. Finish the session settled.' }
];

/* ---------- starter exercise library (short reminders, not coaching programmes) ---------- */
PT.SEED_EXERCISES = [
  ['Bench press', ['chest', 'arms'], 'Shoulder blades back and down, feet planted, bar to mid-chest.'],
  ['Incline dumbbell press', ['chest', 'shoulders'], 'Bench at about 30 degrees, press up and slightly in.'],
  ['Push-up', ['chest', 'arms', 'core'], 'Straight line from head to heels, elbows about 45 degrees.'],
  ['Cable fly', ['chest'], 'Soft elbows, hug a barrel, control the stretch.'],
  ['Overhead press', ['shoulders', 'arms'], 'Ribs down, glutes tight, head through at the top.'],
  ['Lateral raise', ['shoulders'], 'Lead with the elbows, stop at shoulder height.'],
  ['Pull-up', ['back', 'arms'], 'Start from a dead hang, chest to the bar, no swinging.'],
  ['Lat pulldown', ['back'], 'Pull elbows down to the ribs, chest up.'],
  ['Barbell row', ['back'], 'Hinge to about 45 degrees, flat back, pull to the lower ribs.'],
  ['Seated cable row', ['back'], 'Tall chest, squeeze the shoulder blades, no leaning back.'],
  ['Deadlift', ['back', 'legs'], 'Bar over mid-foot, brace, push the floor away.'],
  ['Romanian deadlift', ['legs', 'back'], 'Soft knees, hips back, bar close to the legs.'],
  ['Back squat', ['legs', 'core'], 'Brace, knees track over toes, hit your depth with control.'],
  ['Front squat', ['legs', 'core'], 'Elbows high, upright torso.'],
  ['Leg press', ['legs'], 'Feet shoulder width, lower until just before the hips tuck.'],
  ['Walking lunge', ['legs'], 'Long step, back knee kisses the floor, torso tall.'],
  ['Hip thrust', ['legs'], 'Chin tucked, drive through the heels, squeeze at the top.'],
  ['Calf raise', ['legs'], 'Full stretch at the bottom, pause at the top.'],
  ['Biceps curl', ['arms'], 'Elbows pinned to the sides, no swinging.'],
  ['Triceps pushdown', ['arms'], 'Elbows fixed, fully lock out.'],
  ['Plank', ['core'], 'Ribs down, glutes squeezed, long neck.'],
  ['Hanging knee raise', ['core'], 'Curl the pelvis up, do not just swing the legs.'],
  ["Farmer's carry", ['full', 'core'], 'Tall posture, short quick steps, grip hard.'],
  ['Kettlebell swing', ['legs', 'back', 'full'], 'Hinge, not squat. Snap the hips, arms just guide.']
];
PT.SEED_EXTRA = [
  ['Easy run', ['run', 'legs'], 'cardio', 'km', 'Conversational pace.'],
  ['Tempo run', ['run', 'legs'], 'cardio', 'km', 'Comfortably hard, steady.'],
  ['Fartlek', ['run', 'legs'], 'cardio', 'km', 'Mix fast and easy bursts by feel.'],
  ['Long run', ['run', 'legs'], 'cardio', 'km', 'Slow and steady, build time on feet.'],
  ['Freestyle swim', ['swim', 'shoulders', 'back'], 'cardio', 'm', 'Long strokes, relaxed breathing.'],
  ['Swim intervals', ['swim', 'shoulders', 'back'], 'cardio', 'm', 'Fast reps with short rests.'],
  ['Bike ride', ['bike', 'legs'], 'cardio', 'km', ''],
  ['Bag work', ['mma', 'full'], 'time', '', 'Rounds on the heavy bag.'],
  ['Pad work', ['mma', 'full'], 'time', '', ''],
  ['Shadow boxing', ['mma', 'full'], 'time', '', 'Footwork, head movement, clean technique.'],
  ['Grappling / rolling', ['mma', 'full', 'core'], 'time', '', ''],
  ['Sparring', ['mma', 'full'], 'time', '', ''],
  ['Skipping', ['mma', 'legs', 'full'], 'time', '', '']
];
if (!PT.state.seeded) {
  if (!PT.state.exercises.length) PT.state.exercises = PT.SEED_EXERCISES.map(([name, muscles, notes]) => ({ id: PT.uid(), name, muscles, notes, link: '' }));
  PT.state.seeded = true; PT.save();
}
/* Upgrade older saved data (v1) to the current shape. Nothing is deleted. */
PT.migrate = function () {
  const st = PT.state; if ((st.v || 1) >= 2) return;
  st.exercises.forEach(e => { if (!e.kind) e.kind = 'strength'; });
  const have = new Set(st.exercises.map(e => e.name.toLowerCase()));
  PT.SEED_EXTRA.forEach(([name, muscles, kind, unit, notes]) => { if (!have.has(name.toLowerCase())) st.exercises.push({ id: PT.uid(), name, muscles, kind, unit, notes, link: '' }); });
  // foods were per 100 g; they become "per portion" where one portion = 100 g, so the numbers still match
  st.foods.forEach(f => { if (f.portionG == null) { f.portionG = 100; f.group = f.group || 'other'; } });
  st.meals.forEach(m => { m.items = (m.items || []).map(it => it.qty != null ? it : { foodId: it.foodId, qty: (+it.grams || 0) / 100 }); });
  st.v = 2; PT.save();
};
PT.migrate();

/* ---------- daily quote (only from quotes you add yourself) ---------- */
PT.todayQuote = () => {
  const q = PT.state.quotes; if (!q.length) return null;
  const n = Math.floor(PT.parse(PT.today()).getTime() / 86400000);
  return q[n % q.length];
};
})();
