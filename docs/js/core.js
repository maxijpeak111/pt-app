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
    settings: { minPct: 60, maxPct: 110, bodyKg: '', targets: { kcal: '', p: '', c: '', f: '' }, ownOnly: false },
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
PT.replaceState = obj => { PT.state = merge(defaults(), obj); PT.save(); };
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
PT.TYPES = [['strength', 'Strength'], ['run', 'Run'], ['swim', 'Swim'], ['mma', 'MMA'], ['other', 'Other']];
PT.typeLabel = t => (PT.TYPES.find(x => x[0] === t) || [0, 'Other'])[1];
PT.TAGS = [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'], ['legs', 'Legs'], ['core', 'Core'], ['run', 'Running'], ['swim', 'Swimming'], ['mma', 'MMA'], ['full', 'Full body']];
PT.tagLabel = t => (PT.TAGS.find(x => x[0] === t) || [0, t])[1];
PT.defaultTags = { strength: [], run: ['run', 'legs'], swim: ['swim', 'shoulders', 'back'], mma: ['mma', 'full'], other: [] };
PT.defaultKind = t => (t === 'run' || t === 'swim') ? 'cardio' : 'strength';
PT.defaultUnit = t => t === 'swim' ? 'm' : 'km';
PT.newEx = type => ({ id: PT.uid(), name: '', kind: PT.defaultKind(type), sets: 3, reps: 10, kg: '', distance: '', unit: PT.defaultUnit(type), pace: 0, time: 0, notes: '' });
PT.exText = ex => {
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

/* ---------- nutrition maths ---------- */
PT.macrosOf = (food, g) => ({ kcal: food.kcal * g / 100, p: food.p * g / 100, c: food.c * g / 100, f: food.f * g / 100 });
PT.sumMacros = list => list.reduce((a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.p || 0), c: a.c + (+m.c || 0), f: a.f + (+m.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
PT.mealTotals = meal => PT.sumMacros(meal.items.map(it => { const f = PT.state.foods.find(x => x.id === it.foodId); return f ? PT.macrosOf(f, it.grams) : { kcal: 0, p: 0, c: 0, f: 0 }; }));
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
if (!PT.state.seeded) {
  if (!PT.state.exercises.length) PT.state.exercises = PT.SEED_EXERCISES.map(([name, muscles, notes]) => ({ id: PT.uid(), name, muscles, notes, link: '' }));
  PT.state.seeded = true; PT.save();
}

/* ---------- daily quote (only from quotes you add yourself) ---------- */
PT.todayQuote = () => {
  const q = PT.state.quotes; if (!q.length) return null;
  const n = Math.floor(PT.parse(PT.today()).getTime() / 86400000);
  return q[n % q.length];
};
})();
