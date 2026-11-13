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
// Training load 0–10: your hardest planned session that day, plus 2 for each extra session.
PT.dayLoad = date => {
  const items = ((PT.state.plan[date] || {}).items) || [];
  const lv = items.map(it => PT.itemLevel(it, PT.session(it.sessionId))).filter(Boolean);
  if (!lv.length) return 0;
  return Math.min(10, Math.max(...lv) + 2 * (lv.length - 1));
};
// Rest-day targets are yours; on training days the extra calories (up to your hardest-day number) go to carbs.
PT.dayTargets = date => {
  const s = PT.state.settings, t = s.targets, load = PT.dayLoad(date);
  const base = { kcal: num(t.kcal), p: num(t.p), c: num(t.c), f: num(t.f), load, extra: 0 };
  if (!base.kcal || !num(s.hardKcal) || num(s.hardKcal) <= base.kcal || !load) return base;
  const extra = Math.round((num(s.hardKcal) - base.kcal) * load / 10 / 10) * 10;
  return Object.assign(base, { kcal: base.kcal + extra, c: base.c ? base.c + Math.round(extra / 4) : 0, extra });
};

PT.views.fuel = function (parts) {
  if (parts[1] === 'foods') return foodsView();
  if (parts[1] === 'meals') return mealsView();
  return diaryView(parts[1] || PT.today());
};

function meter(label, val, target, unit) {
  const pct = target ? Math.min(100, val / target * 100) : 0;
  return h('div', { style: { marginBottom: '10px' } },
    h('div', { class: 'row between small' }, h('b', {}, label), h('span', { class: 'muted' }, g0(val) + (target ? ' / ' + target : '') + ' ' + unit)),
    h('div', { class: 'bar' + (target && val >= target ? ' ok' : '') }, h('i', { style: { width: pct + '%' } })));
}

/* ---------- daily diary ---------- */
function diaryView(date) {
  const log = PT.state.foodLog[date] || [], t = PT.dayTargets(date), tot = PT.sumMacros(log);
  const hasTargets = t.kcal || t.p || t.c || t.f;
  const bySlot = {};
  log.forEach(e => (bySlot[e.slot || 'other'] = bySlot[e.slot || 'other'] || []).push(e));
  const order = PT.SLOTS.map(x => x[0]).concat('other').filter(k => bySlot[k]);
  return h('div', {},
    h('h1', {}, 'Fuel'),
    h('div', { class: 'week-nav' },
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, -1); } }, '‹'),
      h('div', { class: 'week-title' }, date === PT.today() ? 'Today · ' + PT.niceDate(date) : PT.niceDate(date)),
      h('button', { class: 'btn ghost small', onclick: () => { location.hash = '#/fuel/' + PT.addDays(date, 1); } }, '›')),
    h('div', { class: 'card' },
      h('div', { class: 'small', style: { marginBottom: '10px' } },
        t.load ? [h('b', { class: 'red' }, 'Training load ' + t.load + '/10'), t.extra ? ' · target up ' + t.extra + ' kcal' : ''] : h('b', {}, 'Rest day')),
      meter('Calories', tot.kcal, t.kcal, 'kcal'), meter('Protein', tot.p, t.p, 'g'),
      meter('Carbs', tot.c, t.c, 'g'), meter('Fat', tot.f, t.f, 'g'),
      !hasTargets ? h('div', { class: 'small muted' }, 'No targets set yet. Tap Targets below.') : null),
    h('button', { class: 'btn block', onclick: () => PT.addMealSheet(date) }, '+ Add meal'),
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
      h('button', { class: 'btn ghost small', onclick: targetsSheet }, 'Targets')));
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
function foodsView() {
  const open = f => { const box = h('div', {}); const sh = PT.sheet(f ? 'Edit food' : 'New food', box); foodForm(box, f, null, () => { sh.close(); PT.render(); }); };
  return h('div', {}, PT.back('#/fuel', 'Fuel'), h('h1', {}, 'My foods'),
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
function mealsView() {
  return h('div', {}, PT.back('#/fuel', 'Fuel'), h('h1', {}, 'Usual meals'),
    h('p', { class: 'muted small' }, 'Combinations you eat often. Make one by ticking "Save as a usual meal" when you add a meal, or build one here.'),
    h('button', { class: 'btn block', onclick: () => mealForm(null) }, '+ New usual meal'), gap(12),
    PT.state.meals.length ? PT.state.meals.map(m => h('div', { class: 'card tap', onclick: () => mealForm(m) },
      h('b', {}, m.name), h('div', { class: 'small' }, m.items.map(it => { const f = food(it.foodId); return f ? f.name + (qtyText(f, it.qty) ? ' ' + qtyText(f, it.qty) : '') : null; }).filter(Boolean).join(' + ')),
      h('div', { class: 'small muted' }, macroLine(PT.mealTotals(m))))) : h('div', { class: 'empty' }, 'No usual meals yet.'));
}
function mealForm(meal) {
  if (!PT.state.foods.length) { PT.toast('Add some foods first'); location.hash = '#/fuel/foods'; return; }
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
function targetsSheet() {
  const s = PT.state.settings, t = Object.assign({}, s.targets);
  let kg = s.bodyKg, hard = s.hardKcal;
  const box = h('div', {});
  function draw() {
    PT.fill(box,
      h('p', { class: 'small muted' }, 'You set the numbers. A common starting point in sports nutrition is about 1.6 to 2.2 g of protein per kg of body weight, and roughly 5 to 8 g of carbs per kg on heavy endurance days. A registered dietitian can tailor this to you.'),
      h('h3', {}, 'Rest day'),
      h('div', { class: 'grid2' }, PT.field('Calories', PT.numInput(t.kcal, v => t.kcal = v)), PT.field('Body weight kg', PT.numInput(kg, v => kg = v))), gap(8),
      h('button', { class: 'btn ghost small', onclick: () => {
        if (!num(t.kcal) || !num(kg)) { PT.toast('Enter calories and body weight first'); return; }
        t.p = Math.round(1.8 * num(kg)); t.f = Math.round(num(t.kcal) * 0.25 / 9); t.c = Math.max(0, Math.round((num(t.kcal) - t.p * 4 - t.f * 9) / 4)); draw();
      } }, 'Suggest split (1.8 g/kg protein, 25% fat)'), gap(10),
      h('div', { class: 'grid3' }, PT.field('Protein g', PT.numInput(t.p, v => t.p = v)), PT.field('Carbs g', PT.numInput(t.c, v => t.c = v)), PT.field('Fat g', PT.numInput(t.f, v => t.f = v))), gap(14),
      h('h3', {}, 'Training days'),
      h('p', { class: 'small muted' }, 'Calories on your hardest day (load 10/10). Other training days sit in between, based on the levels of the sessions you have planned. The extra calories go to carbs. Leave empty to keep the same target every day.'),
      PT.field('Hardest day calories', PT.numInput(hard, v => hard = v)), gap(12),
      h('button', { class: 'btn block', onclick: () => { s.targets = { kcal: t.kcal, p: t.p, c: t.c, f: t.f }; s.bodyKg = kg; s.hardKcal = hard; PT.save(); sh.close(); PT.render(); } }, 'Save targets'));
  }
  const sh = PT.sheet('Daily targets', box);
  draw();
}
})();
