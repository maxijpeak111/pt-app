(function () {
'use strict';
const PT = window.PT, h = PT.h;
const num = v => (v === '' || v == null) ? 0 : +v;
const g0 = n => Math.round(n);
const gap = px => h('div', { style: { height: px + 'px' } });

PT.FOOD_GROUPS = [['protein', 'Protein'], ['carbs', 'Carbs'], ['veg', 'Veg & fruit'], ['fats', 'Fats & sauces'], ['snacks', 'Snacks'], ['drinks', 'Drinks'], ['other', 'Other']];
PT.SLOTS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snack'], ['pre', 'Pre-workout'], ['post', 'Post-workout']];
const slotLabel = k => (PT.SLOTS.find(x => x[0] === k) || [0, 'Other'])[1];
const macroLine = m => g0(m.kcal) + ' kcal · P ' + g0(m.p) + ' · C ' + g0(m.c) + ' · F ' + g0(m.f);
const food = id => PT.state.foods.find(x => x.id === id);
const qtyText = (f, qty) => f && +f.portionG ? g0(qty * f.portionG) + ' g' : (qty === 1 ? '' : '×' + PT.r1(qty)) + (f && f.portion ? (qty === 1 ? '' : ' ') + f.portion : '');

/* ---------- how hard the day is → calorie target ---------- */
// Training load 0–10: the average level of the day's exercises, plus 1 for every 4 exercises beyond the first 4.
// Training load 0–10 for fuelling. Sports-nutrition guidance scales carbohydrate with the day's training volume
// (roughly 3–5 g/kg light, 5–7 g/kg ~1 h, 6–10 g/kg 1–3 h a day), so the number of sessions sets the load:
// rest day 0, one session 5, two or more 10. Once you rate how hard the day was (1–10, after training),
// that nudges it: a 6 keeps it, harder raises it, easier lowers it.
PT.dayLoad = date => {
  const n = PT.daySessions(date).length;
  if (!n) return 0;
  const base = n >= 2 ? 10 : 5, rpe = +((PT.state.plan[date] || {}).rpe) || 0;
  return rpe ? Math.min(10, Math.max(1, Math.round(base * rpe / 6))) : base;
};
// Goals rise with how hard the day is: rest-day goals at load 0, your hardest-day goals at load 10,
// and every training day in between (e.g. load 5 = halfway). Each macro scales on its own.
PT.maxGoals = () => {
  const s = PT.state.settings, t = s.targets, m = Object.assign({ kcal: '', p: '', c: '', f: '' }, s.maxTargets);
  // older setting: only "hardest day calories", with the extra going to carbs
  if (!num(m.kcal) && num(s.hardKcal) > num(t.kcal)) { m.kcal = num(s.hardKcal); if (num(t.c) && !num(m.c)) m.c = num(t.c) + Math.round((num(s.hardKcal) - num(t.kcal)) / 4); }
  return m;
};
PT.dayTargets = date => {
  const t = PT.state.settings.targets, mx = PT.maxGoals(), load = PT.dayLoad(date);
  const o = { load, extra: 0 };
  ['kcal', 'p', 'c', 'f'].forEach(k => {
    const rest = num(t[k]), hard = num(mx[k]);
    const v = hard > rest && rest ? rest + (hard - rest) * load / 10 : rest;
    o[k] = rest ? (k === 'kcal' ? Math.round(v / 10) * 10 : Math.round(v)) : 0;
  });
  o.extra = o.kcal - num(t.kcal);
  return o;
};

/* ---------- actual totals vs goals ---------- */
// What you actually had: the totals you type at the end of the day; any you leave blank come from meals you logged.
PT.MACROS = [['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
PT.fuelActual = date => {
  const typed = PT.state.fuelActual[date] || {}, log = PT.state.foodLog[date] || [], meals = PT.sumMacros(log);
  const o = {};
  PT.MACROS.forEach(([k]) => { o[k] = typed[k] !== '' && typed[k] != null ? +typed[k] : log.length ? Math.round(meals[k]) : null; });
  return o;
};
PT.macroOk = (actual, target) => !!target && actual != null && Math.abs(actual - target) <= target * 0.1;
// true = every macro you have a goal for is within 10%; false = logged but off; null = not logged / no goals.
PT.macrosMet = date => {
  const t = PT.dayTargets(date), a = PT.fuelActual(date);
  const ks = PT.MACROS.map(m => m[0]).filter(k => +t[k]);
  if (!ks.length || ks.some(k => a[k] == null)) return null;
  return ks.every(k => PT.macroOk(a[k], +t[k]));
};
// Last 14 days of eating success, plus your current streak of days met.
PT.fuelHistory = () => {
  const days = []; for (let i = 13; i >= 0; i--) days.push(PT.addDays(PT.today(), -i));
  const res = days.map(d => ({ d, met: PT.macrosMet(d) }));
  let streak = 0;
  for (let i = res.length - 1; i >= 0; i--) {
    if (res[i].met === true) streak++;
    else if (i === res.length - 1 && res[i].met === null) continue; // today not logged yet
    else break;
  }
  return { res, streak, met: res.filter(x => x.met === true).length };
};
PT.fuelTracker = () => {
  const hst = PT.fuelHistory();
  return h('div', {},
    h('div', { class: 'row between small' }, h('b', {}, 'Macros met: ' + hst.met + ' of the last 14 days'), h('span', { class: hst.streak ? 'ok' : 'muted', style: { fontWeight: 800 } }, hst.streak ? hst.streak + ' day streak' : 'no streak yet')),
    h('div', { class: 'dots' }, hst.res.map(x => h('i', { class: x.met === true ? 'met' : x.met === false ? 'miss' : '', title: x.d }))),
    h('div', { class: 'small muted' }, 'Green = all macros within 10% of your goal · red outline = logged but off · grey = not logged'));
};
const statusText = (a, t, unit) => {
  if (!+t) return '';
  if (a == null) return '';
  if (PT.macroOk(a, +t)) return '✓';
  const d = Math.round(a - t); return (d > 0 ? '+' : '') + d + ' ' + unit;
};
// Goals pre-filled and faded in each box; type what you actually had. onChange() runs after every edit.
PT.fuelBlock = (date, onChange) => {
  const t = PT.dayTargets(date), log = PT.state.foodLog[date] || [], meals = PT.sumMacros(log);
  const rows = PT.MACROS.map(([k, label, unit]) => {
    const typed = (PT.state.fuelActual[date] || {})[k];
    const st = h('span', { class: 'small', style: { fontWeight: 800, textAlign: 'right' } });
    const upd = () => { const a = PT.fuelActual(date)[k]; st.textContent = statusText(a, t[k], unit); st.className = 'small ' + (PT.macroOk(a, +t[k]) ? 'ok' : 'red'); };
    const inp = PT.numInput(typed != null && typed !== '' ? typed : (log.length ? Math.round(meals[k]) : ''), v => {
      const fa = PT.state.fuelActual[date] = PT.state.fuelActual[date] || {}; fa[k] = v; PT.save(); upd(); if (onChange) onChange();
    }, +t[k] ? String(t[k]) : '', '1');
    upd();
    return h('div', { class: 'macro-row' }, h('div', {}, h('b', {}, label), h('div', { class: 'small muted' }, +t[k] ? 'goal ' + t[k] + ' ' + unit : 'no goal set')), inp, st);
  });
  const hasT = PT.MACROS.some(([k]) => +t[k]);
  return h('div', {},
    h('div', { class: 'small', style: { marginBottom: '6px' } },
      t.load ? [h('b', { class: 'red' }, PT.daySessions(date).length + (PT.daySessions(date).length === 1 ? ' session' : ' sessions') + ((PT.state.plan[date] || {}).rpe ? ' · rated ' + PT.state.plan[date].rpe + '/10' : '')), t.extra > 0 ? ' · goals raised for training (+' + t.extra + ' kcal)' : ''] : h('b', {}, 'Rest day goals'),
      h('span', { class: 'muted' }, ' · faded numbers are your goals, type what you actually had')),
    rows,
    log.length ? h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Boxes start from the meals you logged; type over them if needed.') : null,
    !hasT ? h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'No goals yet: tap Daily macro goals.') : null);
};
// Meals eaten on a day, with + Add meal (from your Meal library or single foods).
PT.dayMeals = date => {
  const log = PT.state.foodLog[date] || [];
  return h('div', { style: { marginTop: '10px' } },
    log.map(e => h('div', { class: 'card', style: { marginBottom: '6px' } },
      h('div', { class: 'row between', style: { flexWrap: 'nowrap' } }, h('div', {}, h('b', {}, e.label), h('div', { class: 'small muted' }, slotLabel(e.slot || 'other') + ' · ' + macroLine(e))),
        h('button', { class: 'btn ghost small', 'aria-label': 'Remove', onclick: () => { PT.state.foodLog[date] = log.filter(x => x.id !== e.id); PT.save(); PT.render(); } }, '✕')))),
    h('button', { class: 'btn ghost block', onclick: () => PT.addMealSheet(date) }, '+ Add meal'));
};
PT.fuelSummary = date => {
  const t = PT.dayTargets(date), a = PT.fuelActual(date), m = PT.macrosMet(date);
  return (a.kcal != null ? a.kcal : '–') + (t.kcal ? ' / ' + t.kcal : '') + ' kcal' + (m === true ? ' · ✓ macros met' : m === false ? ' · macros off target' : '');
};

PT.views.fuel = function (parts) {
  if (parts[1] === 'foods') return foodsView();
  if (parts[1] === 'meals') return mealsView();
  return diaryView(parts[1] || PT.today());
};


/* ---------- daily diary ---------- */
function diaryView(date) {
  const log = PT.state.foodLog[date] || [];
  const bySlot = {};
  log.forEach(e => (bySlot[e.slot || 'other'] = bySlot[e.slot || 'other'] || []).push(e));
  const order = PT.SLOTS.map(x => x[0]).concat('other').filter(k => bySlot[k]);
  return h('div', {},
    h('h1', {}, 'Fuel'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, -1); } }, '‹'),
      h('div', { class: 'week-title' }, date === PT.today() ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)),
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, 1); } }, '›')),
    h('div', { class: 'card' }, PT.fuelBlock(date)),
    h('div', { class: 'card' }, PT.fuelTracker()),
    h('h2', {}, 'Meals (optional)'),
    h('button', { class: 'btn ghost block', onclick: () => PT.addMealSheet(date) }, '+ Add meal'),
    log.length ? order.map(k => {
      const sub = PT.sumMacros(bySlot[k]);
      return [h('h2', {}, slotLabel(k) + ' · ' + g0(sub.kcal) + ' kcal'),
        bySlot[k].map(e => h('div', { class: 'card' },
          h('div', { class: 'row between', style: { flexWrap: 'nowrap' } }, h('b', {}, e.label),
            h('button', { class: 'btn danger small', onclick: () => { PT.state.foodLog[date] = log.filter(x => x.id !== e.id); PT.save(); PT.render(); } }, '✕')),
          e.items && e.items.length ? h('div', { class: 'small' }, e.items.map(it => it.name + (it.text ? ' ' + it.text : '')).join(' + ')) : null,
          h('div', { class: 'small muted' }, macroLine(e))))];
    }) : [h('h2', {}, 'Eaten'), h('div', { class: 'empty' }, 'Nothing logged for this day.')],
    h('h2', {}, 'Set up'),
    h('div', { class: 'grid3' },
      h('a', { class: 'btn ghost small', href: '#/fuel/foods' }, 'My foods'),
      h('a', { class: 'btn ghost small', href: '#/fuel/meals' }, 'Usual meals'),
      h('button', { class: 'btn ghost small', onclick: targetsSheet }, 'Goals')));
}

function addEntry(date, entry) {
  (PT.state.foodLog[date] = PT.state.foodLog[date] || []).push(Object.assign({ id: PT.uid() }, entry));
  PT.save(); PT.render();
}

/* ---------- add meal: pick the slot, then stack foods ---------- */
PT.addMealSheet = function (date) {
  const box = h('div', {});
  const sh = PT.sheet('Add meal', box);
  const plate = []; // { foodId, qty }
  let slot = null, saveAs = false, mealName = '', nameTouched = false;
  const hr = new Date().getHours();
  const guess = hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';

  function chooseSlot() {
    PT.fill(box, h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Which meal?'),
      h('div', { class: 'folders' }, PT.SLOTS.map(([k, l]) => h('div', { class: 'folder-tile' + (k === guess ? ' on' : ''), onclick: () => { slot = k; plateView(); } }, h('b', {}, l)))),
      gap(14), h('button', { class: 'btn ghost small block', onclick: quickForm }, 'Quick add (just numbers)'));
  }

  const autoName = () => plate.map(it => (food(it.foodId) || {}).name).filter(Boolean).join(' + ');
  function addToPlate(items) {
    items.forEach(it => {
      const f = food(it.foodId); if (!f) return;
      const same = plate.find(p => p.foodId === it.foodId);
      if (same) same.qty = PT.r1(same.qty + it.qty); else plate.push({ foodId: it.foodId, qty: it.qty });
    });
    if (!nameTouched) mealName = autoName();
  }

  function plateView() {
    const tot = PT.sumMacros(plate.map(it => PT.macrosOf(food(it.foodId), it.qty)));
    const usual = PT.state.meals;
    PT.fill(box,
      h('button', { class: 'back', onclick: chooseSlot }, '‹ ' + slotLabel(slot)),
      plate.length ? h('div', { class: 'card' },
        plate.map((it, i) => {
          const f = food(it.foodId);
          const qtyCtl = +f.portionG
            ? h('div', { style: { width: '86px', flex: 'none' } }, PT.numInput(g0(it.qty * f.portionG), v => { it.qty = num(v) / f.portionG; totLine(); }, 'g', '5'))
            : h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '4px', flex: 'none' } },
                h('button', { class: 'btn ghost small', onclick: () => { it.qty = Math.max(0.5, it.qty - 0.5); plateView(); } }, '−'),
                h('span', { style: { minWidth: '34px', textAlign: 'center' } }, '×' + PT.r1(it.qty)),
                h('button', { class: 'btn ghost small', onclick: () => { it.qty += 0.5; plateView(); } }, '+'));
          return h('div', { class: 'row between', style: { flexWrap: 'nowrap', marginBottom: '8px' } },
            h('div', { class: 'grow' }, h('b', {}, f.name), f.portion && !+f.portionG ? h('div', { class: 'small muted' }, f.portion) : null),
            qtyCtl,
            h('button', { class: 'btn danger small', onclick: () => { plate.splice(i, 1); if (!nameTouched) mealName = autoName(); plateView(); } }, '✕'));
        }),
        h('div', { class: 'stat', id: 'plate-tot' }, macroLine(tot))) : h('div', { class: 'empty' }, 'Your plate is empty. Tap a usual meal or open a folder below.'),
      usual.length ? [h('h2', {}, 'Your usual meals'), h('div', {}, usual.map(m => h('span', { class: 'chip', onclick: () => { addToPlate(m.items); plateView(); } }, '+ ' + m.name)))] : null,
      h('h2', {}, 'Foods'),
      h('div', { class: 'folders' }, PT.FOOD_GROUPS.map(([k, l]) => {
        const n = PT.state.foods.filter(f => (f.group || 'other') === k).length;
        return h('div', { class: 'folder-tile', onclick: () => groupView(k, l) }, h('b', {}, l), h('span', { class: 'small muted' }, n + ' foods'));
      })),
      plate.length ? [gap(14),
        h('label', { class: 'checkrow' }, h('input', { type: 'checkbox', checked: saveAs, onchange: e => { saveAs = e.target.checked; plateView(); } }), h('div', {}, 'Save as a usual meal')),
        saveAs ? h('input', { value: mealName, placeholder: 'Meal name', oninput: e => { mealName = e.target.value; nameTouched = true; } }) : null, gap(10),
        h('button', { class: 'btn block', onclick: finish }, 'Add to ' + slotLabel(slot))] : null);
  }
  function totLine() {
    const el = document.getElementById('plate-tot'); if (!el) return;
    el.textContent = macroLine(PT.sumMacros(plate.map(it => PT.macrosOf(food(it.foodId), it.qty))));
  }

  function groupView(k, l) {
    const rows = PT.state.foods.filter(f => (f.group || 'other') === k).sort((a, b) => a.name.localeCompare(b.name));
    PT.fill(box, h('button', { class: 'back', onclick: plateView }, '‹ Plate'), h('h2', { style: { marginTop: '4px' } }, l),
      rows.length ? rows.map(f => h('div', { class: 'card tap', onclick: () => { addToPlate([{ foodId: f.id, qty: 1 }]); PT.toast('Added ' + f.name); plateView(); } },
        h('div', { class: 'row between' }, h('b', {}, f.name), h('span', { class: 'small muted' }, portionText(f))),
        h('div', { class: 'small muted' }, macroLine(f)))) : h('div', { class: 'empty' }, 'No foods here yet.'),
      h('button', { class: 'btn ghost block', onclick: () => foodForm(box, null, k, f => { addToPlate([{ foodId: f.id, qty: 1 }]); plateView(); }, () => groupView(k, l)) }, '+ New food'));
  }

  function finish() {
    if (!plate.length) return;
    const items = plate.map(it => { const f = food(it.foodId); return { foodId: f.id, name: f.name, qty: it.qty, text: qtyText(f, it.qty) }; });
    const tot = PT.sumMacros(plate.map(it => PT.macrosOf(food(it.foodId), it.qty)));
    if (saveAs) {
      const name = (mealName || autoName()).trim();
      const ex = PT.state.meals.find(m => m.name.toLowerCase() === name.toLowerCase());
      const m = { id: ex ? ex.id : PT.uid(), name, items: plate.map(it => ({ foodId: it.foodId, qty: it.qty })) };
      if (ex) Object.assign(ex, m); else PT.state.meals.push(m);
    }
    sh.close();
    addEntry(date, Object.assign({ slot, label: (saveAs && mealName.trim()) || autoName(), items }, tot));
    PT.toast('Added to ' + slotLabel(slot));
  }

  function quickForm() {
    const d = { label: '', kcal: '', p: '', c: '', f: '' }; let sl = guess;
    PT.fill(box, h('button', { class: 'back', onclick: chooseSlot }, '‹ Back'),
      PT.seg(PT.SLOTS.slice(0, 4), sl, v => sl = v), gap(10),
      PT.field('What was it?', h('input', { oninput: e => d.label = e.target.value })), gap(10),
      h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(d.kcal, v => d.kcal = v)), PT.field('Protein g', PT.numInput(d.p, v => d.p = v)),
        PT.field('Carbs g', PT.numInput(d.c, v => d.c = v)), PT.field('Fat g', PT.numInput(d.f, v => d.f = v))), gap(12),
      h('button', { class: 'btn block', onclick: () => { sh.close(); addEntry(date, { slot: sl, label: d.label.trim() || 'Quick add', kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.f) }); } }, 'Add'));
  }
  chooseSlot();
};

const portionText = f => +f.portionG ? 'per ' + f.portionG + ' g' + (f.portion ? ' (' + f.portion + ')' : '') : (f.portion ? 'per ' + f.portion : 'per portion');

/* ---------- a food: your usual portion and its macros ---------- */
function foodForm(box, existing, group, onSaved, onBack) {
  const d = existing ? Object.assign({}, existing) : { id: PT.uid(), name: '', group: group || 'protein', portion: '', portionG: '', kcal: '', p: '', c: '', f: '' };
  PT.fill(box,
    onBack ? h('button', { class: 'back', onclick: onBack }, '‹ Back') : null,
    PT.field('Name', h('input', { value: d.name, placeholder: 'e.g. Chicken breast', oninput: e => d.name = e.target.value })), gap(10),
    h('label', { class: 'f' }, 'Folder'), h('select', { onchange: e => d.group = e.target.value }, PT.FOOD_GROUPS.map(([k, l]) => h('option', { value: k, selected: k === d.group }, l))), gap(10),
    h('p', { class: 'small muted' }, 'Your usual portion. Add grams if you want to type exact weights later (e.g. 250 g chicken); leave grams empty to just count portions.'),
    h('div', { class: 'grid2' },
      PT.field('Portion name (optional)', h('input', { value: d.portion || '', placeholder: 'e.g. 1 breast, 1 bowl', oninput: e => d.portion = e.target.value })),
      PT.field('Grams (optional)', PT.numInput(d.portionG, v => d.portionG = v, 'e.g. 200', '1'))), gap(10),
    h('p', { class: 'small muted' }, 'Macros for that portion'),
    h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(d.kcal, v => d.kcal = v)), PT.field('Protein g', PT.numInput(d.p, v => d.p = v)),
      PT.field('Carbs g', PT.numInput(d.c, v => d.c = v)), PT.field('Fat g', PT.numInput(d.f, v => d.f = v))), gap(12),
    h('button', { class: 'btn block', onclick: () => {
      if (!d.name.trim()) { PT.toast('Name it first'); return; }
      if (!num(d.kcal) && !num(d.p) && !num(d.c) && !num(d.f)) { PT.toast('Add the macros for your portion'); return; }
      const out = { id: d.id, name: d.name.trim(), group: d.group, portion: (d.portion || '').trim(), portionG: num(d.portionG) || '', kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.f) };
      const i = PT.state.foods.findIndex(x => x.id === d.id); if (i >= 0) PT.state.foods[i] = out; else PT.state.foods.push(out);
      PT.save(); onSaved(out);
    } }, 'Save food'),
    existing ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete "' + existing.name + '"? Usual meals using it will lose that item.', 'Delete', () => {
      PT.state.foods = PT.state.foods.filter(x => x.id !== existing.id); PT.state.meals.forEach(m => m.items = m.items.filter(it => it.foodId !== existing.id)); PT.save(); PT.render();
    }) }, 'Delete food')) : null);
}

/* ---------- my foods ---------- */
PT.foodsView = () => foodsView();
function foodsView() {
  const open = f => { const box = h('div', {}); const sh = PT.sheet(f ? 'Edit food' : 'New food', box); foodForm(box, f, null, () => { sh.close(); PT.render(); }); };
  return h('div', {}, PT.back('#/library/meals', 'Meal library'), h('h1', {}, 'My foods'),
    h('p', { class: 'muted small' }, 'Each food remembers your usual portion and its macros, so you only type them once.'),
    h('button', { class: 'btn block', onclick: () => open(null) }, '+ New food'),
    PT.FOOD_GROUPS.map(([k, l]) => {
      const rows = PT.state.foods.filter(f => (f.group || 'other') === k).sort((a, b) => a.name.localeCompare(b.name));
      return rows.length ? [h('h2', {}, l), rows.map(f => h('div', { class: 'card tap', onclick: () => open(f) },
        h('div', { class: 'row between' }, h('b', {}, f.name), h('span', { class: 'small muted' }, portionText(f))), h('div', { class: 'small muted' }, macroLine(f))))] : null;
    }),
    !PT.state.foods.length ? h('div', { class: 'empty', style: { marginTop: '12px' } }, 'No foods yet. You can also add them while adding a meal.') : null);
}

/* ---------- usual meals ---------- */
PT.mealsView = () => mealsView();
function mealsView() {
  const t = PT.state.settings.targets, mx = PT.maxGoals();
  const line = o => num(o.kcal) ? num(o.kcal) + ' kcal · P ' + num(o.p) + ' · C ' + num(o.c) + ' · F ' + num(o.f) : 'not set';
  return h('div', {}, PT.back('#/library', 'Library'), h('h1', {}, 'Meal library'),
    h('div', { class: 'card tap', onclick: () => targetsSheet() },
      h('div', { class: 'row between' }, h('b', {}, 'Daily macro goals'), h('span', { class: 'red' }, '›')),
      h('div', { class: 'small muted' }, 'Rest day: ' + line(t)), h('div', { class: 'small muted' }, 'Two-session day: ' + line(mx))),
    h('a', { class: 'card tap', href: '#/library/foods' }, h('div', { class: 'row between' }, h('b', {}, 'My foods · ' + PT.state.foods.length), h('span', { class: 'red' }, '›')),
      h('div', { class: 'small muted' }, 'Each food with your usual portion and its macros')),
    h('h2', {}, 'Meals'),
    h('p', { class: 'muted small' }, 'Meals you eat often. Add them to any day from the Fuel box on that day.'),
    h('button', { class: 'btn block', onclick: () => mealForm(null) }, '+ New meal'), gap(12),
    PT.state.meals.length ? PT.state.meals.map(m => h('div', { class: 'card tap', onclick: () => mealForm(m) },
      h('b', {}, m.name), h('div', { class: 'small' }, m.items.map(it => { const f = food(it.foodId); return f ? f.name + (qtyText(f, it.qty) ? ' ' + qtyText(f, it.qty) : '') : null; }).filter(Boolean).join(' + ')),
      h('div', { class: 'small muted' }, macroLine(PT.mealTotals(m))))) : h('div', { class: 'empty' }, 'No usual meals yet.'));
}
function mealForm(meal) {
  if (!PT.state.foods.length) { PT.toast('Add some foods first'); location.hash = '#/library/foods'; return; }
  const d = meal ? JSON.parse(JSON.stringify(meal)) : { id: PT.uid(), name: '', items: [{ foodId: PT.state.foods[0].id, qty: 1 }] };
  const box = h('div', {}), tot = h('div', { class: 'stat' });
  const refreshTotals = () => { tot.textContent = macroLine(PT.mealTotals(d)); };
  function draw() {
    PT.fill(box,
      PT.field('Meal name', h('input', { value: d.name, placeholder: 'e.g. Chicken, rice and veg', oninput: e => d.name = e.target.value })), gap(10),
      d.items.map((it, i) => {
        const f = food(it.foodId) || PT.state.foods[0];
        const q = +f.portionG ? PT.numInput(g0(it.qty * f.portionG), v => { it.qty = num(v) / f.portionG; refreshTotals(); }, 'g', '5') : PT.numInput(it.qty, v => { it.qty = num(v); refreshTotals(); }, 'portions', '0.5');
        return h('div', { class: 'row', style: { marginBottom: '8px', flexWrap: 'nowrap' } },
          h('select', { class: 'grow', onchange: e => { it.foodId = e.target.value; draw(); } }, PT.state.foods.map(x => h('option', { value: x.id, selected: x.id === it.foodId }, x.name))),
          h('div', { style: { width: '86px', flex: 'none' } }, q),
          h('button', { class: 'btn danger small', onclick: () => { d.items.splice(i, 1); draw(); } }, '✕'));
      }),
      h('div', { class: 'small muted' }, 'Amount is grams for foods with a gram portion, otherwise number of portions.'),
      h('button', { class: 'btn ghost small', style: { marginTop: '8px' }, onclick: () => { d.items.push({ foodId: PT.state.foods[0].id, qty: 1 }); draw(); } }, '+ Add item'),
      h('div', { class: 'card', style: { marginTop: '12px' } }, tot),
      h('button', { class: 'btn block', onclick: save }, 'Save meal'),
      meal ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn danger block', onclick: () => PT.confirm('Delete "' + meal.name + '"?', 'Delete', () => { PT.state.meals = PT.state.meals.filter(x => x.id !== meal.id); PT.save(); PT.render(); }) }, 'Delete meal')) : null);
    refreshTotals();
  }
  function save() {
    if (!d.name.trim()) { PT.toast('Name the meal'); return; }
    if (!d.items.length) { PT.toast('Add at least one item'); return; }
    const out = { id: d.id, name: d.name.trim(), items: d.items.map(it => ({ foodId: it.foodId, qty: num(it.qty) })) };
    const i = PT.state.meals.findIndex(x => x.id === d.id); if (i >= 0) PT.state.meals[i] = out; else PT.state.meals.push(out);
    PT.save(); sh.close(); PT.render();
  }
  const sh = PT.sheet(meal ? 'Edit usual meal' : 'New usual meal', box);
  draw();
}

/* ---------- targets ---------- */
PT.targetsSheet = () => targetsSheet();
function targetsSheet() {
  const s = PT.state.settings, t = Object.assign({}, s.targets), m = Object.assign({}, PT.maxGoals());
  let kg = s.bodyKg;
  const box = h('div', {});
  const row = (o, label) => h('div', { class: 'grid2', style: { marginBottom: '8px' } },
    PT.field('Calories', PT.numInput(o.kcal, v => o.kcal = v)), PT.field('Protein g', PT.numInput(o.p, v => o.p = v)),
    PT.field('Carbs g', PT.numInput(o.c, v => o.c = v)), PT.field('Fat g', PT.numInput(o.f, v => o.f = v)));
  function draw() {
    PT.fill(box,
      h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Your goals rise with how much you train. Rest days use the first set, days with two or more sessions the second, and one-session days sit halfway. Rating how hard a day was afterwards nudges it up or down.'),
      h('p', { class: 'small muted' }, 'Based on sports-nutrition guidance (ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada 2016; ISSN 2017): carbs rise with training (about 3–5 g/kg on light days, 5–7 on ~1 h days, 6–10 on 1–3 h days); protein stays fairly steady at 1.4–2.0 g/kg; fat around 1 g/kg (at least 20% of calories). The Suggest buttons use these. A registered sports dietitian can tailor them to you.'),
      h('h3', {}, 'Rest day'),
      PT.field('Body weight kg (for the suggestions)', PT.numInput(kg, v => kg = v)), gap(8),
      h('button', { class: 'btn ghost small', onclick: () => {
        if (!num(kg)) { PT.toast('Enter your body weight first'); return; }
        const w = num(kg); t.p = Math.round(1.8 * w); t.c = Math.round(4 * w); t.f = Math.round(1 * w); t.kcal = Math.round((t.p * 4 + t.c * 4 + t.f * 9) / 10) * 10; draw();
      } }, 'Suggest rest day (P 1.8 · C 4 · F 1 g/kg)'), gap(10),
      row(t),
      h('h3', { style: { marginTop: '10px' } }, 'Two-session day (hardest)'),
      h('button', { class: 'btn ghost small', onclick: () => {
        if (!num(kg)) { PT.toast('Enter your body weight first'); return; }
        const w = num(kg); m.p = Math.round(2 * w); m.c = Math.round(8 * w); m.f = Math.round(1 * w); m.kcal = Math.round((m.p * 4 + m.c * 4 + m.f * 9) / 10) * 10; draw();
      } }, 'Suggest 2-session day (P 2 · C 8 · F 1 g/kg)'), gap(10),
      row(m),
      h('p', { class: 'small muted' }, 'Leave the hardest day empty to keep the same goals every day.'),
      h('button', { class: 'btn block', onclick: () => {
        s.targets = { kcal: t.kcal, p: t.p, c: t.c, f: t.f }; s.maxTargets = { kcal: m.kcal, p: m.p, c: m.c, f: m.f }; s.hardKcal = ''; s.bodyKg = kg;
        PT.save(); sh.close(); PT.render();
      } }, 'Save goals'));
  }
  const sh = PT.sheet('Daily macro goals', box);
  draw();
}
})();
